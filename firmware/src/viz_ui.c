/* SPDX-License-Identifier: GPL-3.0-only */
/* KITTEN RACK: the visualizers (the user, 2026-10-29), after the device page: HOME on the device page with nothing to go
 * back to opens the oscilloscope (page 14), HOME again the VJ screen (page 15), HOME again the device page. Orange on
 * black. The audio comes from the ISR's tap (viz_tap.h, only while a visualizer shows, at half the rate); each frame
 * redraws only what changed:
 *   scope  a trigger on the rising zero crossing, about 11 ms across, its gain following the level; column by column
 *   VJ     a 30 x 27 grid of 8 px cells in six shades of orange (viz_tables.h), five scenes in turn (every 10 s, or on a
 *          beat after 5): a corridor of squares rushing out, a starburst with a shock ring on the beat, three helices,
 *          a spiral, a mirrored plasma; the bass, the middle and the highs (from the samples: a low pass, the rest, the slope) and a
 *          beat drive them. Only the cells whose shade changed go out.
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

static uint8_t viz_lo[240], viz_hi[240];        /* the scope's trace per column as drawn (lo > hi: none) */
static uint32_t viz_gain = 256u;                /* the scope's gain, Q8 */
static uint32_t viz_ms;                         /* the last frame */
static uint8_t viz_ok;                          /* the page is on the LCD (else drawn whole) */

static int viz_page(void) { return page == PAGE_VIZ1 || page == PAGE_VIZ2; }

/* sample i of the last n (oldest first) */
#define VIZ_AT(w, n, i) viz_ring[((w) - (n) + (i)) & (VIZ_RING - 1u)]

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
    uint32_t w = viz_w;
    uint32_t i, start = 0, peak = 0, x;
    int32_t prev;
    if (full || !viz_ok) {
        viz_ground(LG("OSCILLOSCOPE", "OSCILOSCOPIO"));
        for (x = 0; x < 240u; x++) {
            viz_lo[x] = 1;
            viz_hi[x] = 0;
        }
        viz_ok = 1;
    }
    for (i = 1; i < 300u; i++)                  /* the trigger: rising through zero */
        if (VIZ_AT(w, 560u, i - 1u) < 0 && VIZ_AT(w, 560u, i) >= 0) {
            start = i;
            break;
        }
    for (i = start; i < start + 240u; i++) {
        int32_t v = VIZ_AT(w, 560u, i);
        uint32_t a = (uint32_t)(v < 0 ? -v : v);
        if (a > peak)
            peak = a;
    }
    {                                           /* the gain: the trace's peak at about 90 pixels, slowly */
        uint32_t want = peak > 600u ? (90u << 16) / peak : (90u << 16) / 600u;   /* (Q8: 90 px over peak / 256) */
        want = want > 4096u ? 4096u : want;
        viz_gain = (viz_gain * 7u + want) / 8u;
    }
    prev = (int32_t)VIZ_YC - (int32_t)(((int32_t)VIZ_AT(w, 560u, start) * (int32_t)viz_gain) >> 8) / 256;
    for (x = 0; x < 240u; x++) {
        int32_t v = VIZ_AT(w, 560u, start + x), y = (int32_t)VIZ_YC - ((v * (int32_t)viz_gain) >> 8) / 256, lo, hi, a, b, k;
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
            lcd_line[k - a] = (uint16_t)((c >> 8) | (c << 8));   /* (the LCD takes big endian) */
        }
        scr_erase(x, (uint32_t)a, 1, (uint32_t)(b - a + 1));
        lcd_blit(x, (uint32_t)a, 1, (uint32_t)(b - a + 1), lcd_line);   /* (lcd.c's own line, after lcd_sync) */
        viz_lo[x] = (uint8_t)lo;
        viz_hi[x] = (uint8_t)hi;
    }
}

/* ---- the VJ screen */
#include "viz_tables.h"
#define VJ_Y0 24u
static uint8_t vj_drawn[VJ_W * VJ_H] ENG_POOL;   /* each cell's shade as drawn (0xFF: not yet) */
static uint32_t vj_t, vj_scene, vj_since, vj_beat_ms;
static uint32_t vj_bass, vj_mid, vj_high, vj_pulse, vj_ring;   /* 0..255; the beat's flash; the shock ring's radius */
static uint32_t vj_avg = 64u, vj_max[3] = {2000u, 2000u, 2000u};
static const uint16_t VJ_PAL[6] = {0x0000u, 0x2860u, 0x5900u, 0xAA20u, 0xFBC3u, 0xFE4Au};

/* the bass, the middle, the highs of the last 512 samples (half rate), each 0..255 of what it reached lately */
static void vj_listen(void)
{
    uint32_t w = viz_w, i, lo = 0, all = 0, hi = 0, f[3], k;
    int32_t lp = 0, prev = 0;
    for (i = 0; i < 512u; i++) {
        int32_t x = viz_ring[(w - 512u + i) & (VIZ_RING - 1u)];
        lp += (x - lp) >> 4;                    /* (about 230 Hz) */
        all += (uint32_t)(x < 0 ? -x : x);
        lo += (uint32_t)(lp < 0 ? -lp : lp);
        hi += (uint32_t)(x - prev < 0 ? prev - x : x - prev);
        prev = x;
    }
    f[0] = lo >> 9;
    f[1] = all > lo ? (all - lo) >> 9 : 0u;
    f[2] = hi >> 9;
    for (k = 0; k < 3u; k++) {                  /* each against its own recent top, so any level moves the screen */
        vj_max[k] = f[k] > vj_max[k] ? f[k] : vj_max[k] - (vj_max[k] >> 6);
        if (vj_max[k] < 300u)
            vj_max[k] = 300u;
        f[k] = f[k] * 255u / vj_max[k];
    }
    vj_bass = f[0];
    vj_mid = f[1];
    vj_high = f[2];
    if (vj_bass > vj_avg + 60u && fm1_ms - vj_beat_ms > 180u) {   /* a beat: the bass jumps over its average */
        vj_beat_ms = fm1_ms;
        vj_pulse = 255u;
        vj_ring = 0;
        if (fm1_ms - vj_since > 5000u) {
            vj_scene = (vj_scene + 1u) % 5u;
            vj_since = fm1_ms;
        }
    }
    vj_avg = (vj_avg * 15u + vj_bass) / 16u;
}

static int32_t vj_abs(int32_t v) { return v < 0 ? -v : v; }
/* cell (x, y)'s shade, 0..5, in the scene playing */
static uint32_t vj_cell(uint32_t x, uint32_t y)
{
    uint32_t i = y * VJ_W + x, r = VJ_R[i], a = VJ_A[i], t = vj_t;
    switch (vj_scene) {
    case 0: {                                   /* the corridor: squares rushing out, lights along its walls */
        uint32_t c = VJ_C[i], z = (c + 256u - (t * 3u & 255u)) & 31u;
        if (c < 10u)
            return vj_pulse > 128u ? 3u : 0u;   /* (the far end, lit by the beat) */
        if (z < 5u)
            return vj_bass > 150u ? 5u : 4u;
        if (z < 8u)
            return 2u;
        if (((a + (t >> 2)) & 7u) == 0u && z < 14u)
            return vj_high > 120u ? 5u : 3u;
        return c > 100u ? 1u : 0u;
    }
    case 1: {                                   /* the starburst: rays out of a glowing middle, a shock ring on the beat */
        uint32_t k = (a * 4u + (t >> 1)) & 15u, len = 40u + vj_bass / 2u, wid = 3u + vj_mid / 48u;
        if (r < 10u + vj_bass / 12u)
            return 5u;
        if (vj_pulse && vj_abs((int32_t)r - (int32_t)vj_ring) < 6)
            return 5u;
        if (k < wid && r < len)
            return r < len / 2u ? 5u : 4u;
        if (k < wid + 2u && r < len + 20u)
            return 2u;
        if (((i * 37u + t * 5u) % 61u) == 0u && vj_high > 90u)
            return 3u;
        return r > 140u && ((a + t) & 15u) == 0u ? 1u : 0u;
    }
    case 2: {                                   /* three helices turning, rungs between their strands */
        uint32_t col = x < 10u ? 0u : x < 20u ? 1u : 2u, xc = 5u + 10u * col, ph = (y * 3u + t + col * 21u) & 63u;
        int32_t amp = 2 + (int32_t)(vj_mid / 64u), off = VJ_SIN[ph] * amp / 127, back = VJ_SIN[(ph + 32u) & 63u] * amp / 127;
        int32_t dx = (int32_t)x - (int32_t)xc, depth = VJ_SIN[(ph + 16u) & 63u];
        if (dx == off)
            return depth > 0 ? 5u : 3u;
        if (dx == back)
            return depth > 0 ? 2u : 4u;
        if (((y + (t >> 1)) % 3u) == 0u && ((dx > off && dx < back) || (dx < off && dx > back)))
            return vj_bass > 160u ? 3u : 1u;
        return 0u;
    }
    case 3: {                                   /* the spiral: four arms winding in, the bass widening them */
        uint32_t k = (a + r / 4u + 256u - (t * 2u & 255u)) & 63u, wid = 6u + vj_bass / 32u;
        if (r < 6u)
            return vj_pulse > 100u ? 5u : 3u;
        if ((k & 15u) < wid / 2u)
            return r < 60u ? 5u : r < 110u ? 4u : 3u;
        if ((k & 15u) < wid / 2u + 2u)
            return 2u;
        return vj_pulse > 160u && r > 150u ? 1u : 0u;
    }
    default: {                                  /* the plasma, mirrored four ways, banded */
        int32_t dx = vj_abs((int32_t)(x * 2u) - (int32_t)(VJ_W - 1u)), dy = vj_abs((int32_t)(y * 2u) - (int32_t)(VJ_H - 1u));
        int32_t v = VJ_SIN[(uint32_t)(dx * 3 + (int32_t)t) & 63u] + VJ_SIN[(uint32_t)(dy * 4 - (int32_t)t) & 63u]
                    + VJ_SIN[(r / 3u + t * 2u) & 63u] + (int32_t)vj_bass;
        static const uint8_t BAND[8] = {0, 1, 2, 3, 4, 5, 3, 1};
        return BAND[((uint32_t)(v + 400) / 48u + (t >> 3)) & 7u];
    }
    }
}

static void viz_vj(int full)
{
    uint32_t x, y, i;
    if (full || !viz_ok) {
        viz_ground("VISUAL");
        for (i = 0; i < VJ_W * VJ_H; i++)
            vj_drawn[i] = 0;
        vj_since = fm1_ms;
        viz_ok = 1;
    }
    vj_listen();
    vj_t++;
    vj_pulse = vj_pulse > 24u ? vj_pulse - 24u : 0u;
    vj_ring += 12u;
    if (fm1_ms - vj_since > 10000u) {           /* the next scene, if no beat brought it */
        vj_scene = (vj_scene + 1u) % 5u;
        vj_since = fm1_ms;
    }
    for (y = 0; y < VJ_H; y++)
        for (x = 0; x < VJ_W; x++) {
            uint32_t c = vj_cell(x, y);
            i = y * VJ_W + x;
            if (c == vj_drawn[i])
                continue;
            vj_drawn[i] = (uint8_t)c;
            lcd_fill(x * 8u, VJ_Y0 + y * 8u, 8, 8, VJ_PAL[c]);
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
        viz_vj(full);
}
