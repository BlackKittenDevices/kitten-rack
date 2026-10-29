/* SPDX-License-Identifier: GPL-3.0-only */
/* KITTEN RACK: the visualizers (the user, 2026-10-29), after the device page: HOME on the device page with nothing to go
 * back to opens the oscilloscope (page 14), HOME again the spectrum (page 15, mirrored bars round the middle, a VJ's
 * kaleidoscope of the 12 bands), HOME again the device page. Orange on black. The audio comes from the ISR's tap
 * (viz_tap.h, only while a visualizer shows); each frame redraws only what changed, column by column / bar by bar:
 *   scope     a trigger on the rising zero crossing, about 11 ms across, its gain following the level
 *   spectrum  a 256-point FFT of the last samples, 12 bands from 172 Hz up (log spaced), fast up, slow down, a peak dot each
 * The knobs keep their pages (K1..K4 still turn the device page in focus); PRESET the patch. */
#define PAGE_VIZ1 14u
#define PAGE_VIZ2 15u
#define VIZ_Y0 22u
#define VIZ_Y1 238u
#define VIZ_YC ((VIZ_Y0 + VIZ_Y1) / 2u)
#define VIZ_BLACK 0x0000u
#define VIZ_OR 0xFBC3u                  /* the pumpkin of the rest */
#define VIZ_OR_HI 0xFE60u               /* brighter, towards yellow */
#define VIZ_OR_LO 0x81E1u               /* dim */
#define VIZ_OR_DK 0x40E0u               /* very dim: the middle line */
#define VIZ_FRAME_MS 45u

static const int16_t VIZ_SIN[192] = {
    0, 804, 1608, 2410, 3212, 4011, 4808, 5602, 6393, 7179, 7962, 8739, 9512, 10278, 11039, 11793,
    12539, 13279, 14010, 14732, 15446, 16151, 16846, 17530, 18204, 18868, 19519, 20159, 20787, 21403, 22005, 22594,
    23170, 23731, 24279, 24811, 25329, 25832, 26319, 26790, 27245, 27683, 28105, 28510, 28898, 29268, 29621, 29956,
    30273, 30571, 30852, 31113, 31356, 31580, 31785, 31971, 32137, 32285, 32412, 32521, 32609, 32678, 32728, 32757,
    32767, 32757, 32728, 32678, 32609, 32521, 32412, 32285, 32137, 31971, 31785, 31580, 31356, 31113, 30852, 30571,
    30273, 29956, 29621, 29268, 28898, 28510, 28105, 27683, 27245, 26790, 26319, 25832, 25329, 24811, 24279, 23731,
    23170, 22594, 22005, 21403, 20787, 20159, 19519, 18868, 18204, 17530, 16846, 16151, 15446, 14732, 14010, 13279,
    12539, 11793, 11039, 10278, 9512, 8739, 7962, 7179, 6393, 5602, 4808, 4011, 3212, 2410, 1608, 804,
    0, -804, -1608, -2410, -3212, -4011, -4808, -5602, -6393, -7179, -7962, -8739, -9512, -10278, -11039, -11793,
    -12539, -13279, -14010, -14732, -15446, -16151, -16846, -17530, -18204, -18868, -19519, -20159, -20787, -21403, -22005, -22594,
    -23170, -23731, -24279, -24811, -25329, -25832, -26319, -26790, -27245, -27683, -28105, -28510, -28898, -29268, -29621, -29956,
    -30273, -30571, -30852, -31113, -31356, -31580, -31785, -31971, -32137, -32285, -32412, -32521, -32609, -32678, -32728, -32757,
};
static uint8_t viz_lo[240], viz_hi[240];        /* the scope's trace per column as drawn (lo > hi: none) */
static uint8_t viz_bar[24], viz_peak[24];       /* the bars' half heights and peak dots as drawn */
static int32_t viz_lvl[12], viz_pk[12];         /* the bands' levels (Q8 pixels), the peaks' */
static uint32_t viz_gain = 256u;                /* the scope's gain, Q8 */
static uint32_t viz_ms;                         /* the last frame */
static uint8_t viz_ok;                          /* the page is on the LCD (else drawn whole) */
static uint16_t viz_col[VIZ_Y1 - VIZ_Y0];

static int viz_page(void) { return page == PAGE_VIZ1 || page == PAGE_VIZ2; }

/* the last n samples, oldest first */
static void viz_take(int16_t *out, uint32_t n)
{
    uint32_t w = viz_w, i;
    for (i = 0; i < n; i++)
        out[i] = viz_ring[(w - n + i) & (VIZ_RING - 1u)];
}

static void viz_ground(const char *title)
{
    lcd_fill(0, 0, 240, 240, VIZ_BLACK);
    text5x7(4, 6, title, 1, VIZ_OR, VIZ_BLACK);
    text5x7(240u - 6u * 7u, 6, "HOME >>", 1, VIZ_OR_LO, VIZ_BLACK);
    viz_ok = 0;
}

/* ---- the oscilloscope */
static void viz_scope(int full)
{
    static int16_t s[900];
    uint32_t i, start = 0, peak = 0, x;
    int32_t prev;
    if (full || !viz_ok) {
        viz_ground("OSCILOSCOPIO");
        for (x = 0; x < 240u; x++) {
            viz_lo[x] = 1;
            viz_hi[x] = 0;
        }
        viz_ok = 1;
    }
    viz_take(s, 900);
    for (i = 1; i < 420u; i++)                  /* the trigger: rising through zero */
        if (s[i - 1] < 0 && s[i] >= 0) {
            start = i;
            break;
        }
    for (i = start; i < start + 480u; i++) {
        uint32_t a = (uint32_t)(s[i] < 0 ? -s[i] : s[i]);
        if (a > peak)
            peak = a;
    }
    {                                           /* the gain: the trace's peak at about 90 pixels, slowly */
        uint32_t want = peak > 600u ? (90u << 16) / peak : (90u << 16) / 600u;   /* (Q8: 90 px over peak / 256) */
        want = want > 4096u ? 4096u : want;
        viz_gain = (viz_gain * 7u + want) / 8u;
    }
    prev = (int32_t)VIZ_YC - (int32_t)(((int32_t)s[start] * (int32_t)viz_gain) >> 8) / 256;
    for (x = 0; x < 240u; x++) {
        int32_t v = s[start + 2u * x], y = (int32_t)VIZ_YC - ((v * (int32_t)viz_gain) >> 8) / 256, lo, hi, a, b, k;
        y = clampi(y, (int32_t)VIZ_Y0, (int32_t)VIZ_Y1 - 1);
        lo = y < prev ? y : prev;
        hi = y < prev ? prev : y;
        prev = y;
        if (lo == viz_lo[x] && hi == viz_hi[x])
            continue;
        a = viz_lo[x] <= viz_hi[x] && viz_lo[x] < lo ? viz_lo[x] : lo;   /* the column's span: the old trace and the new */
        b = viz_lo[x] <= viz_hi[x] && viz_hi[x] > hi ? viz_hi[x] : hi;
        if ((int32_t)VIZ_YC < a)
            a = (int32_t)VIZ_YC;
        if ((int32_t)VIZ_YC > b)
            b = (int32_t)VIZ_YC;
        lcd_sync();                             /* (the last column's DMA may still read the buffer) */
        for (k = a; k <= b; k++) {
            uint16_t c = k >= lo && k <= hi ? (hi - lo > 6 ? VIZ_OR : VIZ_OR_HI) : k == (int32_t)VIZ_YC ? VIZ_OR_DK : VIZ_BLACK;
            viz_col[k - a] = (uint16_t)((c >> 8) | (c << 8));   /* (the LCD takes big endian) */
        }
        scr_erase(x, (uint32_t)a, 1, (uint32_t)(b - a + 1));
        lcd_blit(x, (uint32_t)a, 1, (uint32_t)(b - a + 1), viz_col);
        viz_lo[x] = (uint8_t)lo;
        viz_hi[x] = (uint8_t)hi;
    }
}

/* ---- the spectrum: a 256-point FFT (Q15 twiddles, a halving each stage) */
static void viz_fft(int32_t *re, int32_t *im)
{
    uint32_t i, j = 0, len, k;
    for (i = 1; i < 256u; i++) {                /* bit reversal */
        uint32_t bit = 128u;
        for (; j & bit; bit >>= 1)
            j ^= bit;
        j |= bit;
        if (i < j) {
            int32_t t = re[i];
            re[i] = re[j];
            re[j] = t;
            t = im[i];
            im[i] = im[j];
            im[j] = t;
        }
    }
    for (len = 2; len <= 256u; len <<= 1) {
        uint32_t step = 256u / len;
        for (i = 0; i < 256u; i += len)
            for (k = 0; k < len / 2u; k++) {
                int32_t c = VIZ_SIN[k * step + 64u], s = -VIZ_SIN[k * step];
                int32_t *ar = &re[i + k], *ai = &im[i + k], *br = &re[i + k + len / 2u], *bi = &im[i + k + len / 2u];
                int32_t tr = (*br * c - *bi * s) >> 15, ti = (*br * s + *bi * c) >> 15;
                *br = (*ar - tr) >> 1;
                *bi = (*ai - ti) >> 1;
                *ar = (*ar + tr) >> 1;
                *ai = (*ai + ti) >> 1;
            }
    }
}
static const uint8_t VIZ_EDGE[13] = {1, 2, 3, 4, 5, 7, 10, 16, 23, 34, 50, 74, 110};

/* a bar's color by its height: dim near the middle, bright at the top */
static uint16_t viz_shade(uint32_t h, uint32_t band)
{
    return h > 70u ? VIZ_OR_HI : h > 30u ? (band < 4u ? VIZ_OR_HI : VIZ_OR) : h > 10u ? VIZ_OR : VIZ_OR_LO;
}
static void viz_spec(int full)
{
    static int32_t re[256], im[256];
    static int16_t s[256];
    uint32_t i, b, energy = 0;
    if (full || !viz_ok) {
        viz_ground("ESPECTRO");
        for (i = 0; i < 24u; i++)
            viz_bar[i] = viz_peak[i] = 0;
        lcd_fill(0, VIZ_YC, 240, 1, VIZ_OR_DK);
        viz_ok = 1;
    }
    viz_take(s, 256);
    for (i = 0; i < 256u; i++) {                /* a triangular window */
        int32_t wv = (int32_t)(i < 128u ? i : 255u - i) * 2 + 1;
        re[i] = ((int32_t)s[i] * wv) >> 8;
        im[i] = 0;
    }
    viz_fft(re, im);
    for (b = 0; b < 12u; b++) {
        uint32_t m = 0, k, lvl;
        for (k = VIZ_EDGE[b]; k < VIZ_EDGE[b + 1u]; k++) {
            uint32_t ar = (uint32_t)(re[k] < 0 ? -re[k] : re[k]), ai = (uint32_t)(im[k] < 0 ? -im[k] : im[k]);
            uint32_t mag = ar > ai ? ar + (ai >> 1) : ai + (ar >> 1);   /* (|z| roughly) */
            if (mag > m)
                m = mag;
        }
        m <<= b / 3u;                           /* (a tilt: the highs lift, as the ear hears them) */
        for (lvl = 0; m > 1u && lvl < 40u; lvl++)   /* the level: 6 dB a step of 2.6 px */
            m >>= 1;
        lvl = lvl * 26u / 10u * 256u;
        lvl = lvl > (100u << 8) ? 100u << 8 : lvl;
        lvl = lvl > (18u << 8) ? lvl - (18u << 8) : 0u;   /* (the floor: quiet bands sleep) */
        viz_lvl[b] = (int32_t)lvl > viz_lvl[b] ? (int32_t)lvl : viz_lvl[b] - (viz_lvl[b] >> 3) - 64;
        if (viz_lvl[b] < 0)
            viz_lvl[b] = 0;
        viz_pk[b] = viz_lvl[b] > viz_pk[b] ? viz_lvl[b] : viz_pk[b] - 96;
        if (viz_pk[b] < 0)
            viz_pk[b] = 0;
        energy += (uint32_t)viz_lvl[b] >> 8;
    }
    (void)energy;
    for (i = 0; i < 24u; i++) {                 /* the kaleidoscope: band 0 in the middle, out to both sides */
        uint32_t band = i < 12u ? 11u - i : i - 12u, x = i * 10u, h = (uint32_t)viz_lvl[band] >> 8, pk = (uint32_t)viz_pk[band] >> 8, old = viz_bar[i];
        if (h > VIZ_YC - VIZ_Y0 - 4u)
            h = VIZ_YC - VIZ_Y0 - 4u;
        if (pk > VIZ_YC - VIZ_Y0 - 2u)
            pk = VIZ_YC - VIZ_Y0 - 2u;
        if (h > old) {                          /* grown: the new rows, above and below the middle */
            uint16_t c = viz_shade(h, band);
            lcd_fill(x, VIZ_YC - h, 9, h - old, c);
            lcd_fill(x, VIZ_YC + 1u + old, 9, h - old, c);
        } else if (h < old) {
            lcd_fill(x, VIZ_YC - old, 9, old - h, VIZ_BLACK);
            lcd_fill(x, VIZ_YC + 1u + h, 9, old - h, VIZ_BLACK);
        }
        viz_bar[i] = (uint8_t)h;
        if (viz_peak[i] != pk) {                /* the peak dots */
            if (viz_peak[i] > h) {
                lcd_fill(x, VIZ_YC - viz_peak[i] - 2u, 9, 2, VIZ_BLACK);
                lcd_fill(x, VIZ_YC + 1u + viz_peak[i], 9, 2, VIZ_BLACK);
            }
            if (pk > h) {
                lcd_fill(x, VIZ_YC - pk - 2u, 9, 2, VIZ_OR_HI);
                lcd_fill(x, VIZ_YC + 1u + pk, 9, 2, VIZ_OR_HI);
            }
            viz_peak[i] = (uint8_t)pk;
        }
    }
}

static void viz_draw(int full)
{
    if (!full && viz_ok && fm1_ms - viz_ms < VIZ_FRAME_MS)
        return;
    viz_ms = fm1_ms;
    if (page == PAGE_VIZ1)
        viz_scope(full);
    else
        viz_spec(full);
}
