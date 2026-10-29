/* SPDX-License-Identifier: GPL-3.0-only */
/* KITTEN RACK: the RACK page (page 12). The patch's devices (pages_ui.c pg_dev: a plain module or an assembly) as
 * Eurorack panels packed into rows of 42 HP, in device order. A panel's width grows with its pages (4 + 2 a page, at
 * most 16 HP); its colour says its family; the dots on its foot are the cables that reach it from other devices (left:
 * in, right: out; pumpkin audio, slime everything else). The device in focus is framed and its cables are drawn; below the
 * rack its page's four rows show, which K1..K4 turn as on the device page. SELECT: the device, ALGO: its page, SEL: its
 * device page, GLO: Main's page, HOME: back.
 *
 * Patching (EDIT opens its menu, from any page, when the patch leaves EDIT free: panel.c kr_button): CABLE NUEVO (SELECT a module, ALGO an output, SEL grabs it; SELECT another
 * module, ALGO an input, SEL plugs it in), CABLES (every cable; SEL twice pulls the one marked), AGREGAR (the catalog
 * by family; SEL puts the module at the end of the rack), QUITAR ULTIMO (the last module added here, with its cables).
 * HOME steps back, EDIT leaves. Each change is an edit of the running binary (patch_edit.h), loaded again as a whole: the
 * notes sounding stop. SAVE keeps it as any edit. */

#include "patch_edit.h"
static uint8_t *rack_scratch(uint32_t *cap);           /* main.c (the upload buffer when no upload runs), host_ui.h */
static int rack_apply(const uint8_t *bin, uint32_t len);   /* the edited binary as the running patch: 0, or eng_load's code */

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
static uint8_t rk_mods[ENG_MAX_MODULES], rk_nmods;      /* the modules a cable can reach, in rack order */
static uint32_t rk_nrows, rk_first, rk_gen = 0xFFFFFFFFu, rk_ndev;
static uint32_t rk_drawn_dev = 0xFFFFFFFFu, rk_drawn_first = 0xFFFFFFFFu;

static uint32_t rk_px(uint32_t hp) { return RK_X0 + hp * RK_W / RK_HP; }

/* a module type's family colour */
static uint16_t rk_family(int t)
{
    switch (t) {
    case T_OSC: case T_NOISE: case T_STRING: case T_WAVETABLE: case T_MODAL: case T_PD: case T_RATIO:
        return P_CORAL;                                 /* sources: pumpkin */
    case T_TURING:
        return P_CORAL;                                 /* (the Turing machine sounds too) */
    case T_FILTER: case T_LADDER: case T_VOWEL: case T_COMB: case T_SHAPE: case T_LPG: case T_MUUG:
        return P_GOLD;                                  /* filters: candle */
    case T_VCA: case T_MIXER: case T_PAN: case T_XFADE: case T_SELECT: case T_DYN: case T_RING:
        return P_SAND;                                  /* VCAs and mixing: bone */
    case T_ADSR: case T_ENV: case T_ENV8: case T_RATEENV: case T_LFO: case T_GLIDE: case T_PULSE: case T_MACRO:
    case T_RANDOM: case T_SH: case T_FUNC: case T_CHAOS:
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
    case T_LPG: return "LPG";        case T_FUNC: return "FUNCTION"; case T_RING: return "RING";
    case T_TURING: return "TURING";  case T_EUCLID: return "EUCLID";  case T_MARBLES: return "MARBLES";
    case T_BERN: return "BERNOULLI"; case T_CHAOS: return "CHAOS";   case T_MUUG: return "MUUG";
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
    if (rk_gen == pg_built_gen && rk_nrows && rk_ndev == pg_ndev)
        return;
    rk_gen = pg_built_gen;
    rk_ndev = pg_ndev;
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
    rk_nmods = 0;
    for (d = 0; d < pg_ndev; d++)
        for (m = 0; m < (uint32_t)eng_nmodules() && m < ENG_MAX_MODULES; m++)
            if (rk_dev_of[m] == d && eng_type(m) != T_PART)
                rk_mods[rk_nmods++] = (uint8_t)m;
}

/* where device d sits on screen; 0 when its row is scrolled away */
static int rk_box(uint32_t d, uint32_t *x, uint32_t *y, uint32_t *w)
{
    if (d >= pg_ndev || !rk_hpw[d] || rk_row[d] < rk_first || rk_row[d] >= rk_first + RK_ROWS)
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

static uint8_t rk_mode;                                 /* RK_VIEW, or patching: */
#define RK_VIEW 0u
#define RK_MENU 1u
#define RK_OUT 2u                                       /* a cable: its output */
#define RK_IN 3u                                        /* .. its input */
#define RK_LIST 4u                                      /* the cables */
#define RK_ADD 5u                                       /* the catalog */
static void rk_edit_draw(void);
static void rk_edit_cable(void);

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
        rk_edit_cable();
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
    if (rk_mode)
        rk_edit_draw();
    else
        rk_info();
}

/* the RACK page opens: the focus stays where it was */
static void rack_open(void)
{
    pages_ensure();
    rk_mode = RK_VIEW;
    rk_drawn_dev = 0xFFFFFFFFu;
}

/* ------------------------------------------------------------------ patching (KITTEN RACK) */

static const char *const RK_MENU_ITEMS[] = {"CABLE NUEVO", "CABLES", "AGREGAR MODULO", "QUITAR ULTIMO AGREGADO"};
#define RK_NMENU 4u
static uint32_t rk_sel;                                 /* the menu's row, the cable list's, the catalog's */
static uint32_t rk_mi, rk_jack;                         /* RK_OUT / RK_IN: the module (rk_mods index), its jack */
static uint32_t rk_src, rk_src_jack;                    /* RK_IN: the output the cable comes from */
static uint32_t rk_armed;                               /* RK_LIST: 1 + the cable SEL pulls on the next press */
static uint32_t rk_added, rk_added_gen;                 /* modules added here since the patch came (only those can go) */

static int rack_editing(void) { return rk_mode != RK_VIEW; }

static void rk_redraw(void)
{
    rk_drawn_dev = 0xFFFFFFFFu;                         /* the panels again (the frame, the cable being made) */
    ui_dirty = 2;
}

/* a module's name on the LCD: its Eurorack name, or its type's */
static const char *rk_mod_name(uint32_t m)
{
    int t = eng_type(m);
    const char *sh = t >= 0 ? rk_short(t) : 0;
    return sh ? sh : t >= 0 ? DEFS[t].name : "?";
}

static uint32_t rk_jacks(uint32_t m, int out)
{
    int t = eng_type(m);
    return t < 0 ? 0u : out ? DEFS[t].nout : DEFS[t].nin;
}
static const char *rk_jack_name(uint32_t m, uint32_t j, int out)
{
    int t = eng_type(m);
    if (t < 0 || j >= rk_jacks(m, out))
        return "";
    return out ? RK_OUTNAMES[t][j] : RK_INNAMES[t][j];
}

/* the module in focus follows the rack's device focus (and the other way round) */
static void rk_focus_mod(void)
{
    uint32_t i;
    rk_layout();
    for (i = 0; i < rk_nmods; i++)
        if (rk_dev_of[rk_mods[i]] == pg_cur_dev) {
            rk_mi = i;
            break;
        }
    rk_jack = 0;
}
static uint32_t rk_cur_mod(void) { return rk_mi < rk_nmods ? rk_mods[rk_mi] : 0xFFu; }

/* SELECT on the rack while patching */
static void rk_turn(int32_t sel, int32_t algo)
{
    uint32_t n;
    rk_layout();
    if (rk_mode == RK_MENU || rk_mode == RK_LIST || rk_mode == RK_ADD) {
        n = rk_mode == RK_MENU ? RK_NMENU : rk_mode == RK_LIST ? (uint32_t)eng_ncables() : RK_NCAT;
        if (n && (sel || algo)) {
            rk_sel = (uint32_t)(((int32_t)rk_sel + (sel + algo) % (int32_t)n + (int32_t)n) % (int32_t)n);
            rk_armed = 0;
            ui_dirty = ui_dirty ? ui_dirty : 1;
        }
        return;
    }
    if ((rk_mode == RK_OUT || rk_mode == RK_IN) && rk_nmods) {
        if (sel) {
            rk_mi = (uint32_t)(((int32_t)rk_mi + sel % (int32_t)rk_nmods + (int32_t)rk_nmods) % (int32_t)rk_nmods);
            rk_jack = 0;
            (void)pages_focus(rk_dev_of[rk_mods[rk_mi]], 0);
            rk_redraw();
        }
        n = rk_jacks(rk_cur_mod(), rk_mode == RK_OUT);
        if (algo && n) {
            rk_jack = (uint32_t)(((int32_t)rk_jack + algo % (int32_t)n + (int32_t)n) % (int32_t)n);
            ui_dirty = ui_dirty ? ui_dirty : 1;
        }
    }
}

/* the running patch copied into the scratch buffer to edit; 0 when there is none or no room */
static uint8_t *rk_begin(uint32_t *len, uint32_t *cap)
{
    const uint8_t *src = pages_src(len);
    uint8_t *b = rack_scratch(cap);
    uint32_t i;
    if (!src || !b || *len > *cap) {
        ui_msg("NO SE PUEDE AHORA", 1500);
        return 0;
    }
    for (i = 0; i < *len; i++)
        b[i] = src[i];
    if (eng_upgrade(b, len, *cap)) {                    /* (the running patch is today's format on the FM-1: proto.c) */
        ui_msg("PATCH LLENO", 1500);
        return 0;
    }
    return b;
}
/* the edit's outcome: loaded and said, or why not */
/* (len by address: the edit is an argument too, and C does not say which argument is worked out first: the FM-1's
 * compiler read the length before the edit grew it, so every edit reached the engine cut short) */
static int rk_finish(uint8_t *b, const uint32_t *lenp, int rc, const char *done)
{
    uint32_t len = *lenp;
#if defined(KR_DEV) && KR_DEV
    uint32_t clen;
    const uint8_t *cur = pages_src(&clen);
#endif
    if (rc == 0 && (rc = rack_apply(b, len)) != 0) {
#if defined(KR_DEV) && KR_DEV                           /* (the development build: both binaries into the last slots, for the emulator's flash) */
        if (cur) (void)sl_write(62, "DBG CUR", cur, clen);
        (void)sl_write(63, "DBG EDIT", b, len);
#endif
        if (rc == -4)
            ui_msg("EL FM-1 TIENE UNO SOLO", 2000);
        else {                                          /* the reason as a code, for a report (main.c rack_apply, eng_load) */
            char m[32], *q = put(m, rc < -100 ? "PATCH INVALIDO " : rc == -100 ? "PATCH MUY LARGO" : "EL MOTOR NO LO TOMA ");
            if (rc != -100) {
                *q++ = 'E';
                fmt_int(q, rc < -100 ? -rc - 100 : -rc);
            }
            ui_msg(m, 2500);
        }
        return rc;
    }
    if (rc)
        ui_msg(rc == -2 ? "PATCH LLENO" : rc == -3 ? "LIMITE DEL FM-1" : rc == -4 ? "YA ESTA" : "NO SE PUEDE AQUI", 1500);
    else {
        ui_msg(done, 1200);
        rk_added_gen = pages_gen();                     /* (our own edit: what was added here still counts) */
    }
    rk_gen = 0xFFFFFFFFu;                               /* the rack again (the pages follow the new binary) */
    rk_redraw();
    return rc;
}

/* SEL on the rack while patching */
static void rk_sel_press(void)
{
    uint8_t *b;
    uint32_t len, cap;
    if (rk_added_gen != pages_gen())
        rk_added = 0;                                   /* (another patch came meanwhile) */
    if (rk_mode == RK_MENU) {
        if (rk_sel == 0u) {
            rk_mode = RK_OUT;
            rk_focus_mod();
        } else if (rk_sel == 1u) {
            rk_mode = RK_LIST;
            rk_sel = 0;
            rk_armed = 0;
        } else if (rk_sel == 2u) {
            rk_mode = RK_ADD;
            rk_sel = 0;
        } else if (!rk_added) {
            ui_msg("NADA AGREGADO AQUI", 1500);
        } else if ((b = rk_begin(&len, &cap)) != 0 && rk_finish(b, &len, pe_module_pop(b, &len), "QUITADO") == 0) {
            rk_added--;
            rk_added_gen = pages_gen();
            if (pg_cur_dev >= pg_ndev && pg_ndev)
                (void)pages_focus(pg_ndev - 1u, 0);
        }
        rk_redraw();
        return;
    }
    if (rk_mode == RK_OUT) {
        if (!rk_jacks(rk_cur_mod(), 1)) {
            ui_msg("SIN SALIDAS", 1200);
            return;
        }
        rk_src = rk_cur_mod();
        rk_src_jack = rk_jack;
        rk_mode = RK_IN;
        rk_jack = 0;
        rk_redraw();
        return;
    }
    if (rk_mode == RK_IN) {
        if (!rk_jacks(rk_cur_mod(), 0)) {
            ui_msg("SIN ENTRADAS", 1200);
            return;
        }
        if ((b = rk_begin(&len, &cap)) != 0 && rk_finish(b, &len, pe_cable_add(b, &len, cap, rk_src, rk_src_jack, rk_cur_mod(), rk_jack), "CABLE LISTO") == 0) {
            rk_mode = RK_OUT;                           /* another cable from the same module, or SELECT on */
            rk_focus_mod();
        }
        rk_redraw();
        return;
    }
    if (rk_mode == RK_LIST) {
        if (!eng_ncables())
            return;
        if (rk_armed != rk_sel + 1u) {
            rk_armed = rk_sel + 1u;                     /* the first press marks it; the second pulls it */
            ui_dirty = ui_dirty ? ui_dirty : 1;
            return;
        }
        rk_armed = 0;
        if ((b = rk_begin(&len, &cap)) != 0 && rk_finish(b, &len, pe_cable_del(b, &len, rk_sel), "CABLE AFUERA") == 0 && rk_sel && rk_sel >= (uint32_t)eng_ncables())
            rk_sel--;
        return;
    }
    if (rk_mode == RK_ADD) {
        uint32_t before = (uint32_t)eng_nmodules();
        if ((b = rk_begin(&len, &cap)) != 0 && rk_finish(b, &len, pe_module_add(b, &len, cap, RK_CAT_TYPE[rk_sel]), "AGREGADO") == 0) {
            rk_added++;
            rk_added_gen = pages_gen();
            rk_layout();
            if (before < ENG_MAX_MODULES && rk_dev_of[before] != RK_NONE)
                (void)pages_focus(rk_dev_of[before], 0);   /* the new panel in focus */
            rk_mode = RK_VIEW;
        }
        rk_redraw();
    }
}

/* REC on the rack: the patching menu, again: out of it */
static void rk_rec_press(void)
{
    rk_mode = rk_mode == RK_VIEW ? RK_MENU : RK_VIEW;
    rk_sel = 0;
    rk_armed = 0;
    rk_redraw();
}
/* HOME while patching: a step back (0: not patching, HOME does its own) */
static int rk_back(void)
{
    if (rk_mode == RK_VIEW)
        return 0;
    rk_mode = rk_mode == RK_IN ? RK_OUT : rk_mode == RK_MENU ? RK_VIEW : RK_MENU;
    rk_sel = 0;
    rk_armed = 0;
    rk_redraw();
    return 1;
}

/* RK_IN: the cable being made, from its output's panel to the panel in focus */
static void rk_edit_cable(void)
{
    uint32_t ax, ay, aw, bx, by, bw, da, db;
    if (rk_mode != RK_IN || rk_src >= ENG_MAX_MODULES || rk_cur_mod() >= ENG_MAX_MODULES)
        return;
    da = rk_dev_of[rk_src];
    db = rk_dev_of[rk_cur_mod()];
    if (da == RK_NONE || db == RK_NONE || !rk_box(da, &ax, &ay, &aw) || !rk_box(db, &bx, &by, &bw))
        return;
    if (da == db) {
        lcd_fill(ax + aw / 2u - 3u, ay + RK_ROW_H - 9u, 6, 6, P_LILAC);
        return;
    }
    rk_curve((int32_t)(ax + aw / 2u), (int32_t)(ay + RK_ROW_H - 12u), (int32_t)(bx + bw / 2u), (int32_t)(by + RK_ROW_H - 12u), P_LILAC);
}

/* a list of n rows in the info area, the row `cur` among them (title above), row text by `row` */
static void rk_list(const char *title, uint32_t n, uint32_t cur, void (*row)(uint32_t i, char *out), uint32_t mark)
{
    uint32_t k, first = cur >= 3u ? cur - 2u : 0u;
    char t[96];
    lcd_fill(0, RK_INFO_Y, 240, 240u - RK_INFO_Y, P_NIGHT);
    text5x7(RK_X0, RK_INFO_Y, title, 1, P_CORAL, P_NIGHT);
    if (first + 4u > n)
        first = n > 4u ? n - 4u : 0u;
    for (k = 0; k < 4u && first + k < n; k++) {
        uint32_t i = first + k, y = RK_INFO_Y + 11u + k * 11u;
        int on = i == cur;
        t[0] = on ? '>' : ' ';
        t[1] = ' ';
        row(i, t + 2);
        t[37] = 0;
        if (on)
            lcd_fill(RK_X0 - 2u, y - 2u, 232, 11, mark == i + 1u ? 0xF800u : P_PANEL);
        text5x7(RK_X0, y, t, 1, on ? P_INK : P_DIM, on ? (mark == i + 1u ? 0xF800u : P_PANEL) : P_NIGHT);
    }
    if (!n)
        text5x7(RK_X0, RK_INFO_Y + 11u, "  (NADA)", 1, P_FAINT, P_NIGHT);
}

static void rk_row_menu(uint32_t i, char *out) { put(out, RK_MENU_ITEMS[i])[0] = 0; }
static void rk_row_cable(uint32_t i, char *out)
{
    uint32_t from = 0, fp = 0, to = 0, tp = 0;
    char *q;
    eng_cable(i, &from, &fp, &to, &tp);
    q = put(out, rk_mod_name(from));
    q = put(q, " ");
    q = put(q, rk_jack_name(from, fp, 1));
    q = put(q, ">");
    q = put(q, rk_mod_name(to));
    q = put(q, " ");
    q = put(q, rk_jack_name(to, tp, 0));
    *q = 0;
}
static void rk_row_cat(uint32_t i, char *out)
{
    char *q = put(out, RK_CAT_LABEL[i]);
    q = put(q, "  ");
    q = put(q, RK_FAMNAME[RK_CAT_FAM[i]]);
    *q = 0;
}
static int rk_jack_out;
static void rk_row_jack(uint32_t i, char *out)
{
    uint32_t m = rk_cur_mod(), k, n = 0, from = 0, fp = 0, to = 0, tp = 0;
    char *q = put(out, rk_jack_name(m, i, rk_jack_out)), num[8];
    for (k = 0; k < (uint32_t)eng_ncables(); k++) {   /* the cables on it already */
        eng_cable(k, &from, &fp, &to, &tp);
        n += rk_jack_out ? (from == m && fp == i) : (to == m && tp == i);
    }
    if (n) {
        fmt_int(num, (int32_t)n);
        q = put(put(put(q, "  ("), num), ")");
    }
    *q = 0;
}

static void rk_edit_draw(void)
{
    char t[48], *q;
    switch (rk_mode) {
    case RK_MENU:
        rk_list("PATCHEO  (EDIT SALE)", RK_NMENU, rk_sel, rk_row_menu, 0);
        break;
    case RK_LIST:
        rk_list(rk_armed ? "CABLES  SEL DE NUEVO: AFUERA" : "CABLES  SEL MARCA", (uint32_t)eng_ncables(), rk_sel, rk_row_cable, rk_armed);
        break;
    case RK_ADD:
        rk_list("AGREGAR  SEL PONE", RK_NCAT, rk_sel, rk_row_cat, 0);
        break;
    case RK_OUT:
    case RK_IN:
        rk_jack_out = rk_mode == RK_OUT;
        if (rk_mode == RK_OUT)
            q = put(put(t, "SALIDA DE "), rk_mod_name(rk_cur_mod()));
        else
            q = put(put(put(put(put(t, rk_mod_name(rk_src)), " "), rk_jack_name(rk_src, rk_src_jack, 1)), " > "), rk_mod_name(rk_cur_mod()));
        *q = 0;
        t[38] = 0;
        rk_list(t, rk_jacks(rk_cur_mod(), rk_jack_out), rk_jack, rk_row_jack, 0);
        break;
    default:
        break;
    }
}
