/* SPDX-License-Identifier: GPL-3.0-only */
/* KITTEN RACK: the RACK page (page 12). The patch's devices (pages_ui.c pg_dev: a plain module or an assembly) as
 * Eurorack panels packed into rows of 42 HP, in device order. A panel's width grows with its pages (4 + 2 a page, at
 * most 16 HP); its colour says its family; the dots on its foot are the cables that reach it from other devices (left:
 * in, right: out; pumpkin audio, slime everything else). The device in focus is framed and its cables are drawn; below the
 * rack its page's four rows show, which K1..K4 turn as on the device page. SELECT: the device, ALGO: its page, SEL: its
 * device page, GLO: Main's page, HOME: back. Read only: nothing here changes the patch's modules or cables. */

#define RK_HP 42u
#define RK_X0 6u
#define RK_W 228u                                       /* 42 HP: 228 / 42 px a HP */
#define RK_Y0 (BAR_H + 4u)
#define RK_ROW_H 46u
#define RK_ROW_GAP 6u
#define RK_ROWS 3u                                      /* rows on screen; more scroll with the focus */
#define RK_INFO_Y (RK_Y0 + RK_ROWS * (RK_ROW_H + RK_ROW_GAP) + 2u)
#define RK_NONE 0xFFu

static uint8_t rk_row[PG_DEVS], rk_hp0[PG_DEVS], rk_hpw[PG_DEVS];
static uint8_t rk_dev_of[ENG_MAX_MODULES];              /* a module's device, RK_NONE: none (inside nothing shown) */
static uint32_t rk_nrows, rk_first, rk_gen = 0xFFFFFFFFu;
static uint32_t rk_drawn_dev = 0xFFFFFFFFu, rk_drawn_first = 0xFFFFFFFFu;

static uint32_t rk_px(uint32_t hp) { return RK_X0 + hp * RK_W / RK_HP; }

/* a module type's family colour */
static uint16_t rk_family(int t)
{
    switch (t) {
    case T_OSC: case T_NOISE: case T_STRING: case T_WAVETABLE: case T_MODAL: case T_PD: case T_RATIO:
        return P_CORAL;                                 /* sources: pumpkin */
    case T_FILTER: case T_LADDER: case T_VOWEL: case T_COMB: case T_SHAPE:
        return P_GOLD;                                  /* filters: candle */
    case T_VCA: case T_MIXER: case T_PAN: case T_XFADE: case T_SELECT: case T_DYN:
        return P_SAND;                                  /* VCAs and mixing: bone */
    case T_ADSR: case T_ENV: case T_ENV8: case T_RATEENV: case T_LFO: case T_GLIDE: case T_PULSE: case T_MACRO:
    case T_RANDOM: case T_SH:
        return P_SEA;                                   /* modulation: slime */
    case T_DELAY: case T_REVERB: case T_CHORUS: case T_PHASER: case T_CRUSH: case T_SHIFT: case T_GRAIN:
        return P_LILAC;                                 /* effects: witch purple */
    case T_FM1: case T_OUTPUT:
        return P_INK;
    default:
        return P_SKY;                                   /* sequencing and logic */
    }
}

/* a plain module's Eurorack name (0: keep the device's own, a Steps track's) */
static const char *rk_short(int t)
{
    switch (t) {
    case T_FM1: return "MIDI-CV";   case T_OSC: return "VCO";        case T_WAVETABLE: return "VCO WT";
    case T_PD: return "VCO CZ";     case T_NOISE: return "NOISE";    case T_STRING: return "STRING";
    case T_MODAL: return "RESON";   case T_FILTER: return "VCF";     case T_LADDER: return "LADDER";
    case T_VOWEL: return "FORMANT"; case T_COMB: return "COMB";      case T_SHAPE: return "FOLDER";
    case T_VCA: return "VCA";       case T_MIXER: return "MIX";      case T_PAN: return "PAN";
    case T_XFADE: return "XFADE";   case T_SELECT: return "SELECT";  case T_DYN: return "COMP";
    case T_ADSR: return "ADSR";     case T_ENV: return "ENV";        case T_ENV8: return "ENV 8";
    case T_RATEENV: return "ENV DX"; case T_LFO: return "LFO";       case T_GLIDE: return "SLEW";
    case T_PULSE: return "PULSE";   case T_MACRO: return "MACRO";    case T_RANDOM: return "RANDOM";
    case T_SH: return "S&H";        case T_DELAY: return "DELAY";    case T_REVERB: return "REVERB";
    case T_CHORUS: return "CHORUS"; case T_PHASER: return "PHASER";  case T_CRUSH: return "CRUSH";
    case T_SHIFT: return "SHIFT";   case T_GRAIN: return "GRAIN";    case T_SEQ: return "SEQ 8";
    case T_CLKDIV: return "CLK DIV"; case T_QUANT: return "QUANT";   case T_MATH: return "MATH";
    case T_LOGIC: return "LOGIC";   case T_CONST: return "OFFSET";   case T_SCALE: return "ATTEN";
    case T_RATIO: return "RATIO";   case T_ARP: return "ARP";        case T_DRUMMAP: return "DRUMS";
    case T_OUTPUT: return "OUT";
    default: return 0;
    }
}

/* the device's colour: a plain module's family; an assembly takes its first module's */
static uint16_t rk_dev_color(uint32_t d)
{
    const pdev_t *dv = &pg_dev[d];
    if (dv->module >= 0)
        return rk_family(eng_type((uint32_t)dv->module));
    if (dv->nmem && dv->mem)
        return rk_family(eng_type(dv->mem[0]));
    return P_GOLD;
}

/* pack the devices into rows and map modules to devices, once per patch (or when the devices were built again) */
static void rk_layout(void)
{
    uint32_t d, x = 0, row = 0, m, k;
    pages_ensure();
    if (rk_gen == pg_built_gen && rk_nrows)
        return;
    rk_gen = pg_built_gen;
    for (m = 0; m < ENG_MAX_MODULES; m++)
        rk_dev_of[m] = RK_NONE;
    for (d = 0; d < pg_ndev; d++) {
        const pdev_t *dv = &pg_dev[d];
        const char *sh = dv->module >= 0 ? rk_short(eng_type((uint32_t)dv->module)) : 0;
        uint32_t n = sh ? str_len(sh) : dv->nlen, w = 4u + 2u * dv->npg, need = ((n * 6u + 8u) * RK_HP + RK_W - 1u) / RK_W;
        w = w < need ? need : w;                        /* wide enough for its name on one line, */
        w = w > 16u ? 16u : w;                          /* .. up to 16 HP: past that the name takes two */
        if (x + w > RK_HP) {
            row++;
            x = 0;
        }
        rk_row[d] = (uint8_t)row;
        rk_hp0[d] = (uint8_t)x;
        rk_hpw[d] = (uint8_t)w;
        x += w;
        if (dv->module >= 0 && (uint32_t)dv->module < ENG_MAX_MODULES)
            rk_dev_of[dv->module] = (uint8_t)d;
        for (k = 0; dv->mem && k < dv->nmem; k++)
            if (dv->mem[k] < ENG_MAX_MODULES && rk_dev_of[dv->mem[k]] == RK_NONE)
                rk_dev_of[dv->mem[k]] = (uint8_t)d;
        /* the pages' rows name modules too: an assembly without extras still owns what it shows */
        for (k = dv->pg0; k < (uint32_t)dv->pg0 + dv->npg; k++) {
            uint32_t r;
            for (r = 0; r < pg_page[k].nrows; r++)
                if (pg_page[k].mod[r] < ENG_MAX_MODULES && rk_dev_of[pg_page[k].mod[r]] == RK_NONE)
                    rk_dev_of[pg_page[k].mod[r]] = (uint8_t)d;
        }
    }
    rk_nrows = pg_ndev ? row + 1u : 0u;
}

/* where device d sits on screen; 0 when its row is scrolled away */
static int rk_box(uint32_t d, uint32_t *x, uint32_t *y, uint32_t *w)
{
    if (d >= pg_ndev || rk_row[d] < rk_first || rk_row[d] >= rk_first + RK_ROWS)
        return 0;
    *x = rk_px(rk_hp0[d]);
    *w = rk_px(rk_hp0[d] + rk_hpw[d]) - *x - 1u;
    *y = RK_Y0 + (rk_row[d] - rk_first) * (RK_ROW_H + RK_ROW_GAP);
    return 1;
}

/* is output `port` of module `m` an audio output */
static int rk_audio(uint32_t m, uint32_t port)
{
    int t = eng_type(m);
    return t >= 0 && port < 16u && (DEFS[t].aout >> port & 1u);
}

static void rk_panel(uint32_t d, int focus)
{
    uint32_t x, y, w, i, from, fp, to, tp, nin = 0, nout = 0, chars, n, cut;
    uint16_t fam = rk_dev_color(d), body = mix565(fam, P_NIGHT, 3u), ink;
    const char *src = pg_dev[d].name, *sh = pg_dev[d].module >= 0 ? rk_short(eng_type((uint32_t)pg_dev[d].module)) : 0;
    char name[40];
    if (!rk_box(d, &x, &y, &w))
        return;
    lcd_fill(x, y, w, RK_ROW_H, body);
    lcd_fill(x, y, w, 3, fam);                          /* the stripe on top */
    lcd_fill(x + 2u, y + 5u, 2, 2, P_FAINT);            /* screws */
    lcd_fill(x + w - 4u, y + 5u, 2, 2, P_FAINT);
    chars = w > 8u ? (w - 4u) / 6u : 0u;
    chars = chars > 22u ? 22u : chars;
    ink = focus ? P_INK : P_DIM;
    if (chars) {                                        /* the name, on two lines when it is long (cut at a space) */
        n = sh ? str_len(sh) : pg_dev[d].nlen;
        caps(name, sh ? sh : src, n, 39);
        cut = n;
        if (n > chars) {
            cut = chars;
            for (i = chars; i > 0u; i--)
                if (name[i] == ' ' || name[i - 1u] == '-') {
                    cut = i;
                    break;
                }
        }
        {
            char a[24], b[24];
            uint32_t k, la = cut < 23u ? cut : 23u, lb = 0;
            for (k = 0; k < la; k++)
                a[k] = name[k];
            a[la] = 0;
            for (k = cut + (name[cut] == ' '); name[k] && lb < chars && lb < 23u; k++)
                b[lb++] = name[k];
            b[lb] = 0;
            text5x7(x + (w - str_len(a) * 6u) / 2u + 1u, y + (lb ? 10u : 14u), a, 1, ink, body);
            if (lb)
                text5x7(x + (w - lb * 6u) / 2u + 1u, y + 20u, b, 1, ink, body);
        }
    }
    /* the cables that reach it from other devices: dots on its foot */
    for (i = 0; i < (uint32_t)eng_ncables(); i++) {
        uint32_t da, db;
        eng_cable(i, &from, &fp, &to, &tp);
        da = from < ENG_MAX_MODULES ? rk_dev_of[from] : RK_NONE;
        db = to < ENG_MAX_MODULES ? rk_dev_of[to] : RK_NONE;
        if (da == db)
            continue;
        if (db == d && 3u + nin * 5u + 3u < w / 2u) {
            lcd_fill(x + 3u + nin * 5u, y + RK_ROW_H - 7u, 3, 3, rk_audio(from, fp) ? P_CORAL : P_SEA);
            nin++;
        }
        if (da == d && 3u + nout * 5u + 3u < w / 2u) {
            lcd_fill(x + w - 6u - nout * 5u, y + RK_ROW_H - 7u, 3, 3, rk_audio(from, fp) ? P_CORAL : P_SEA);
            nout++;
        }
    }
    if (focus) {                                        /* the frame */
        lcd_fill(x, y, w, 2, P_CORAL);
        lcd_fill(x, y + RK_ROW_H - 2u, w, 2, P_CORAL);
        lcd_fill(x, y, 2, RK_ROW_H, P_CORAL);
        lcd_fill(x + w - 2u, y, 2, RK_ROW_H, P_CORAL);
    }
}

/* a cable as a 2 px line (Bresenham), clipped to the rack */
static void rk_line(int32_t x0, int32_t y0, int32_t x1, int32_t y1, uint16_t c)
{
    int32_t dx = x1 > x0 ? x1 - x0 : x0 - x1, dy = y1 > y0 ? y0 - y1 : y1 - y0, sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    int32_t err = dx + dy, e2, top = (int32_t)RK_Y0, bot = (int32_t)(RK_INFO_Y - 4u), n = 0;
    for (;;) {
        if (y0 >= top && y0 < bot && x0 >= 0 && x0 < 239 && (n++ & 1) == 0)
            lcd_fill((uint32_t)x0, (uint32_t)y0, 2, 2, c);
        if (x0 == x1 && y0 == y1)
            break;
        e2 = 2 * err;
        if (e2 >= dy) {
            err += dy;
            x0 += sx;
        }
        if (e2 <= dx) {
            err += dx;
            y0 += sy;
        }
    }
}

/* a hanging cable from foot a to foot b: a quadratic curve that sags below the lower end */
static void rk_curve(int32_t ax, int32_t ay, int32_t bx, int32_t by, uint16_t c)
{
    int32_t dx = bx > ax ? bx - ax : ax - bx, drop = 10 + dx / 5, low = (ay > by ? ay : by) + (drop > 34 ? 34 : drop);
    int32_t cx = (ax + bx) / 2, cy = 2 * low - (ay + by) / 2, px = ax, py = ay, t;
    for (t = 1; t <= 16; t++) {
        int32_t u = 16 - t, x = (u * u * ax + 2 * t * u * cx + t * t * bx) / 256, y = (u * u * ay + 2 * t * u * cy + t * t * by) / 256;
        rk_line(px, py, x, y, c);
        px = x;
        py = y;
    }
}

/* the focused device's cables to other devices, foot to foot */
static void rk_cables(uint32_t d)
{
    uint32_t i, from, fp, to, tp, ax, ay, aw, bx, by, bw;
    for (i = 0; i < (uint32_t)eng_ncables(); i++) {
        uint32_t da, db, o;
        eng_cable(i, &from, &fp, &to, &tp);
        da = from < ENG_MAX_MODULES ? rk_dev_of[from] : RK_NONE;
        db = to < ENG_MAX_MODULES ? rk_dev_of[to] : RK_NONE;
        if (da == db || (da != d && db != d) || da == RK_NONE || db == RK_NONE)
            continue;
        o = da == d ? db : da;
        if (!rk_box(d, &ax, &ay, &aw) || !rk_box(o, &bx, &by, &bw))
            continue;
        rk_curve((int32_t)(ax + aw / 2u), (int32_t)(ay + RK_ROW_H - 12u), (int32_t)(bx + bw / 2u), (int32_t)(by + RK_ROW_H - 12u),
                 rk_audio(from, fp) ? P_CORAL : P_SEA);
    }
}

/* the four rows of the focused device's page: name and value, two by two */
static void rk_info(void)
{
    const ppage_t *pg = pages_now();
    const pdev_t *dv = pg_cur_dev < pg_ndev ? &pg_dev[pg_cur_dev] : 0;
    char t[40], num[20], unit[8], lab[20], *q;
    uint32_t k, base, live;
    lcd_fill(0, RK_INFO_Y, 240, 240u - RK_INFO_Y, P_NIGHT);
    if (!dv || !pg)
        return;
    {
        const char *sh = dv->module >= 0 ? rk_short(eng_type((uint32_t)dv->module)) : 0;
        caps(t, sh ? sh : dv->name, sh ? str_len(sh) : dv->nlen, 18);
    }
    q = t + str_len(t);
    if (dv->npg > 1u) {
        char n[8];
        q = put(q, "  ");
        fmt_int(n, (int32_t)pg_cur_page + 1);
        q = put(q, n);
        q = put(q, "/");
        fmt_int(n, (int32_t)dv->npg);
        q = put(q, n);
    }
    *q = 0;
    text5x7(RK_X0, RK_INFO_Y, t, 1, P_CORAL, P_NIGHT);
    for (k = 0; k < PG_ROWS; k++) {
        uint32_t cx = RK_X0 + (k & 1u) * 116u, cy = RK_INFO_Y + 11u + (k >> 1) * 18u;
        if (k >= pg->nrows)
            continue;
        caps(lab, pg->lab[k], pg->llen[k], 15);
        text5x7(cx, cy, "K", 1, P_FAINT, P_NIGHT);
        fmt_int(num, (int32_t)k + 1);
        text5x7(cx + 6u, cy, num, 1, P_FAINT, P_NIGHT);
        text5x7(cx + 16u, cy, lab, 1, P_DIM, P_NIGHT);
        row_show(pg, k, num, unit, 100, &base, &live);
        q = put(t, num);
        if (unit[0])
            q = put(put(q, " "), unit);
        *q = 0;
        t[15] = 0;
        text5x7(cx + 16u, cy + 8u, t, 1, P_INK, P_NIGHT);
    }
}

static void rack_draw(int full)
{
    uint32_t d, r;
    rk_layout();
    if (full && !msg_until)
        header_draw();
    if (pg_cur_dev < pg_ndev) {                         /* keep the focus on screen */
        r = rk_row[pg_cur_dev];
        if (r < rk_first)
            rk_first = r;
        if (r >= rk_first + RK_ROWS)
            rk_first = r + 1u - RK_ROWS;
    }
    if (full || rk_drawn_dev != pg_cur_dev || rk_drawn_first != rk_first) {
        lcd_fill(0, BAR_H, 240, RK_INFO_Y - BAR_H, P_STRIP);
        for (r = 0; r < RK_ROWS; r++) {                 /* the rails */
            uint32_t y = RK_Y0 + r * (RK_ROW_H + RK_ROW_GAP);
            lcd_fill(RK_X0, y - 2u, RK_W, 1, P_PANEL);
            lcd_fill(RK_X0, y + RK_ROW_H + 1u, RK_W, 1, P_PANEL);
        }
        for (d = 0; d < pg_ndev; d++)
            rk_panel(d, d == pg_cur_dev);
        if (pg_cur_dev < pg_ndev)
            rk_cables(pg_cur_dev);
        if (rk_nrows > RK_ROWS) {                        /* where the screen is in the rack */
            uint32_t h = (RK_INFO_Y - RK_Y0 - 4u) * RK_ROWS / rk_nrows, y = RK_Y0 + (RK_INFO_Y - RK_Y0 - 4u) * rk_first / rk_nrows;
            lcd_fill(237, RK_Y0, 2, RK_INFO_Y - RK_Y0 - 4u, P_PANEL);
            lcd_fill(237, y, 2, h, P_CORAL);
        }
        if (!pg_ndev)
            text5x7(RK_X0, RK_Y0 + 10u, "NO DEVICES ON THIS PATCH", 1, P_FAINT, P_STRIP);
        rk_drawn_dev = pg_cur_dev;
        rk_drawn_first = rk_first;
    }
    pg_strip_dirty = 0;
    rk_info();
}

/* the RACK page opens: the focus stays where it was */
static void rack_open(void)
{
    pages_ensure();
    rk_drawn_dev = 0xFFFFFFFFu;
}
