/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 morgulbrut */
/* The settings menu, after ui.c and before main.c:
 *
 *
 * MENU (HOME held 0.7 s, HOME again closes it): the settings, in tabs like Felucca's menu (its layout, its rows are ours).
 * ALGORITHM steps between the tabs, PRESET and SELECT between the rows, K1..K4 and OCT- / OCT+ change the value of the
 * selected row. The values are applied at once and saved with the state (SAVE: main.c save bits).
 *
 * The state is plain bytes the main loop writes. */

#ifndef FELUCCA_VERSION
#define FELUCCA_VERSION "v?"
#endif
static void leds_avail(void);
static void leds_octave(void);
static void update_only(const char *why);
static void defaults_now(void);
static void settings_store(void);               /* main.c: the settings record now (KITTEN RACK: the language) */

/* ---- settings menu */

enum { MT_PANEL, MT_MIDI, MT_REC, MT_SYSTEM, MT_MANUAL, MT_COUNT };   /* (MANUAL has no rows: a text) */
static const char *const ROW_NAME[MR_COUNT] = {"LEDS", "KNOB ACCEL", "MIDI CHANNEL", "CLOCK IN", "MIDI OUT",
                                              "VERSION", "CPU", "CPU PEAK", "BANK SLOTS", "BATTERY", "UPDATE MODE", "FACTORY RESET", "LANGUAGE",
                                              "CLICK", "CLICK LEVEL", "REC MODE", "REC LENGTH", "REC START", "QUANTIZE", "KEY LIGHTS"};
static const uint8_t ROW_TAB[MR_COUNT] = {MT_PANEL, MT_PANEL, MT_MIDI, MT_MIDI, MT_MIDI, MT_SYSTEM, MT_SYSTEM, MT_SYSTEM, MT_SYSTEM, MT_SYSTEM, MT_SYSTEM,
                                          MT_SYSTEM, MT_PANEL, MT_REC, MT_REC, MT_REC, MT_REC, MT_REC, MT_REC, MT_PANEL};
static const char *const TAB_NAME[MT_COUNT] = {"PANEL", "MIDI", "REC", "SYSTEM", "MANUAL"};
/* KITTEN RACK: the REC tab's values (the REC screen shows them too: seq_ui.c) */
static const char *rec_value(uint32_t row)
{
    static const char *const CLICK[3] = {"OFF", "REC", "ON"}, *const BARS[4] = {"AS IS", "1 BAR", "2 BARS", "4 BARS"};
    static const char *const BARS_ES[4] = {"COMO ESTA", "1 COMPAS", "2 COMPASES", "4 COMPASES"};
    static char lvl[4];
    switch (row) {
    case MR_CLICK: return CLICK[cfg.click % 3u];
    case MR_CLICKLVL: fmt_int(lvl, cfg.click_lvl); return lvl;
    case MR_RMODE: return cfg.rec_free ? LG("FREE", "LIBRE") : LG("GRID", "GRILLA");
    case MR_RBARS: return cfg.lang ? BARS_ES[cfg.rec_bars & 3u] : BARS[cfg.rec_bars & 3u];
    case MR_RSTART: return cfg.rec_count ? LG("COUNT IN", "CUENTA") : LG("FIRST NOTE", "PRIMERA NOTA");
    default: return cfg.rec_quant ? "ON" : "OFF";
    }
}
/* a REC tab setting one step on (the menu's rows, the REC screen's knobs); kept when nothing plays (cfg_poll) */
static void rec_step(uint32_t row, int32_t d)
{
    int up = d > 0;
    switch (row) {
    case MR_CLICK: cfg.click = (uint8_t)clampi((int32_t)cfg.click + (up ? 1 : -1), 0, 2); break;
    case MR_CLICKLVL: cfg.click_lvl = (uint8_t)clampi((int32_t)cfg.click_lvl + (up ? 1 : -1), 1, 10); break;
    case MR_RMODE: cfg.rec_free = (uint8_t)up; break;
    case MR_RBARS: cfg.rec_bars = (uint8_t)clampi((int32_t)cfg.rec_bars + (up ? 1 : -1), 0, 3); break;
    case MR_RSTART: cfg.rec_count = (uint8_t)up; break;
    case MR_RQUANT: cfg.rec_quant = (uint8_t)up; break;
    default: return;
    }
    click_lvl = cfg.click_lvl;
    cfg_dirty = 1;
    cfg_dirty_ms = fm1_ms;
}

static uint8_t menu_tab, menu_sel = MR_LEDS;     /* the tab and the selected row (a row number) */
static uint32_t cpu_peak;                       /* the highest CPU % since boot */
static uint32_t diag_us_peak;                   /* the longest audio ISR in us since the DIAG CPU page was last read (main.c m1_diag) */
static uint32_t update_arm;                     /* UPDATE MODE / DEFAULTS: fm1_ms | 1 of the first OCT+ (the row is menu_sel) */

static uint32_t menu_first(uint32_t tab)
{
    uint32_t r = 0;
    while (r < MR_COUNT && ROW_TAB[r] != tab)
        r++;
    return r < MR_COUNT ? r : 0u;                 /* (the manual has no rows) */
}

static uint32_t menu_count(uint32_t tab)
{
    uint32_t r, n = 0;
    for (r = 0; r < MR_COUNT; r++)
        n += ROW_TAB[r] == tab;
    return n;
}

static uint32_t menu_row_at(uint32_t tab, uint32_t k)   /* the k-th row of the tab (its rows need not be contiguous: CH_TAB) */
{
    uint32_t r;
    for (r = 0; r < MR_COUNT; r++)
        if (ROW_TAB[r] == tab && k-- == 0u)
            return r;
    return menu_first(tab);
}

static uint32_t menu_pos(uint32_t row)                  /* the position of a row within its tab */
{
    uint32_t r, k = 0;
    for (r = 0; r < row; r++)
        k += ROW_TAB[r] == ROW_TAB[row];
    return k;
}

static void menu_value(uint32_t row, char *out)
{
    static const char *const ONOFF[2] = {"OFF", "ON"};
    char *p = out;
    switch (row) {
    case MR_LEDS: p = put(p, cfg.leds == 0 ? "OFF" : cfg.leds == 1 ? "DIM LOW" : "DIM HIGH"); break;
    case MR_ACCEL: p = put(p, ONOFF[cfg.accel]); break;
    case MR_KEYLEDS: p = put(p, ONOFF[cfg.key_leds]); break;
    case MR_LANG: p = put(p, cfg.lang ? "ESPANOL" : "ENGLISH"); break;
    case MR_CLICK: case MR_CLICKLVL: case MR_RMODE: case MR_RBARS: case MR_RSTART: case MR_RQUANT: p = put(p, rec_value(row)); break;
    case MR_CPU:
        fmt_int(p, (int32_t)cpu_pct);
        p += str_len(p);
        *p++ = '%';
        break;
    case MR_SLOTS: {                             /* the occupied slots of the bank */
        uint64_t b = bank_mask;
        uint32_t n = 0;
        for (; b; b &= b - 1u)
            n++;
        fmt_int(p, (int32_t)n);
        p += str_len(p);
        p = put(p, " OF 64");
        break;
    }
    case MR_CH: {
        uint32_t c = cfg.ch;
        if (!c) {
            p = put(p, "OMNI");
        } else {
            fmt_int(p, (int32_t)c);
            p += str_len(p);
        }
        break;
    }
    case MR_CLOCK: p = put(p, ONOFF[cfg.clock_in]); break;
    case MR_MOUT: p = put(p, ONOFF[cfg.midi_out]); break;
    case MR_VERSION: p = put(p, FELUCCA_VERSION); break;
    case MR_BATT: {                              /* the smoothed reading (0..1023) and the bars it gives (ui.c ui_battery) */
        uint8_t s = batt_shown();
        if (s == BATT_NONE) {
            p = put(p, "-");
            break;
        }
        fmt_int(p, batt_raw());
        p += str_len(p);
        p = put(p, "  ");
        if (s == BATT_USB) {
            p = put(p, "USB");
        } else {
            *p++ = (char)('0' + s);
            p = put(p, "/3");
        }
        break;
    }
    case MR_PEAK:
        fmt_int(p, (int32_t)cpu_peak);
        p += str_len(p);
        *p++ = '%';
        break;
    default: p = put(p, update_arm && row == menu_sel ? "OCT+ AGAIN" : "OCT+ TWICE"); break;
    }
    *p = 0;
}

#define MENU_Y 69u                                      /* the first row's top, the rows' pitch (SYSTEM's 7 rows end at 215) */
#define MENU_PITCH 21u
#define MENU_ROW_H 20u
#define MENU_TXT 1u                                     /* a row's text below its top */

/* KITTEN RACK (the owner's mock "MENU 1", 2026-11-15): the menu on a faceplate like the device page's (pages_ui.c PN_*):
 * the tabs engraved above it, the open one in the accent and underlined; on the plate the tab's title, a line, the rows:
 * an LED (lit on the selected row), the name, the value in a window (edged in the accent on the selected row) */
#define MV_X 138u                                       /* a value's window */
#define MV_W 88u
/* a 6 px LED at (x, y) */
static void menu_led(uint32_t x, uint32_t y, uint16_t c, uint16_t bg)
{
    static const uint8_t W[6] = {2, 4, 6, 6, 4, 2};
    uint32_t i;
    lcd_fill(x, y, 6, 6, bg);
    for (i = 0; i < 6u; i++)
        lcd_fill(x + (6u - W[i]) / 2u, y + i, W[i], 1, c);
}
/* the faceplate from y0 to y1: its edge, a screw in each corner */
static void menu_plate(uint32_t y0, uint32_t y1)
{
    static const uint8_t W[5] = {3, 5, 5, 5, 3};
    uint32_t i, k;
    lcd_fill(PN_X0, y0, PN_X1 - PN_X0, y1 - y0, PN_EDGE);
    lcd_fill(PN_X0 + 1u, y0 + 1u, PN_X1 - PN_X0 - 2u, y1 - y0 - 2u, PN_BG);
    for (k = 0; k < 4u; k++) {
        uint32_t x = k & 1u ? PN_X1 - 8u : PN_X0 + 3u, y = k & 2u ? y1 - 8u : y0 + 3u;
        for (i = 0; i < 5u; i++)
            lcd_fill(x + (5u - W[i]) / 2u, y + i, W[i], 1, i == 2u ? PN_SCREW_IN : PN_SCREW);
    }
}

/* a row's value alone, over the old one (text_bc paints its field's background with each scanline: no blink) */
static void menu_value_draw(uint32_t row)
{
    char val[24];
    uint32_t y = MENU_Y + menu_pos(row) * MENU_PITCH;
    int hot = row == menu_sel;
    if (ROW_TAB[row] != menu_tab)
        return;
    menu_value(row, val);
    text_bc(&FONT_M, MV_X + 2u, y + MENU_TXT + 1u, val, hot ? C_ACC : C_FG, EW_BG, MV_W - 6u, TA_RIGHT);
}

static void menu_row_draw(uint32_t row)
{
    int hot = row == menu_sel;
    uint32_t y = MENU_Y + menu_pos(row) * MENU_PITCH;
    uint16_t edge = hot ? C_ACC : KB_RING;
    lcd_fill(14, y, 212, MENU_ROW_H, PN_BG);
    menu_led(15, y + 7u, hot ? C_ACC : KB_RING, PN_BG);
    text_bc(&FONT_M, 27, y + MENU_TXT, ROW_NAME[row], hot ? C_FG : PN_VAL, PN_BG, MV_X - 30u, TA_LEFT);
    lcd_fill(MV_X, y, MV_W, 1, edge);                   /* the value's window */
    lcd_fill(MV_X, y + MENU_ROW_H - 1u, MV_W, 1, edge);
    lcd_fill(MV_X, y + 1u, 1, MENU_ROW_H - 2u, edge);
    lcd_fill(MV_X + MV_W - 1u, y + 1u, 1, MENU_ROW_H - 2u, edge);
    lcd_fill(MV_X + 1u, y + 1u, 1, MENU_ROW_H - 2u, EW_BG);
    lcd_fill(MV_X + MV_W - 4u, y + 1u, 3, MENU_ROW_H - 2u, EW_BG);
    menu_value_draw(row);
}

/* the hint under the plate: each control as a key cap, then what it does */
static void hint_keys(uint32_t y, const char *const *pairs, uint32_t n)
{
    uint32_t i, x = 8;
    lcd_fill(0, y - 3u, 240, FONT_S.h + 5u, C_BG);
    for (i = 0; i < n; i++) {
        uint32_t kw = text_w(&FONT_S, pairs[2u * i], -1) + 8u, tw = text_w(&FONT_S, pairs[2u * i + 1u], -1);
        text_bc(&FONT_S, x, y, pairs[2u * i], C_FG, PN_SCREW_IN, kw, TA_CENTER);
        lcd_fill(x, y + FONT_S.h, kw, 1, PN_CHIP_INK);
        text_bc(&FONT_S, x + kw + 3u, y, pairs[2u * i + 1u], PN_VAL, C_BG, tw, TA_LEFT);
        x += kw + 3u + tw + 10u;
    }
}
static void menu_hint(const char *const *pairs, uint32_t n) { hint_keys(223, pairs, n); }

/* the MANUAL tab (manual.c): MAN_VIS lines from man_top, SELECT scrolls */
#include "manual.c"
#define MAN_Y 70u
#define MAN_VIS 10u
#define MAN_PITCH 14u
static uint32_t man_top;

static void manual_draw(void)
{
    uint32_t i, h = MAN_VIS * MAN_PITCH, thumb, ty;
    for (i = 0; i < MAN_VIS; i++) {                 /* (KITTEN RACK: on the faceplate) */
        uint32_t k = man_top + i, y = MAN_Y + i * MAN_PITCH, c = 0, nm = 0, w;
        uint16_t col = C_FG;
        const char *s = k < MAN_N ? MANUAL[k] : "";
        if (s[0] == '#')
            col = C_ACC;
        else if (s[0] == '~')
            col = C_DIM;
        else if (s[0] == ' ' && s[1] != ' ')         /* "NAME: text": the name (up to a colon in the first 18) in the accent colour */
            while (s[1u + c] && c < 18u && s[1u + c] != ':')
                c++;
        if (s[0] == ' ' && s[1] != ' ' && s[1u + c] == ':')
            nm = c + 1u;
        if (!s[0]) {
            lcd_fill(10, y, 220, MAN_PITCH, PN_BG);
            continue;
        }
        w = nm ? text_bcn(&FONT_S, 10, y, s + 1, (int32_t)nm, C_ACC, PN_BG, 0, TA_LEFT) : 0u;
        text_bc(&FONT_S, 10u + w, y, s + 1 + nm, col, PN_BG, 218u - w, TA_LEFT);
    }
    thumb = h * MAN_VIS / MAN_N;                    /* the scroll bar at the right */
    thumb = thumb < 8u ? 8u : thumb;
    ty = MAN_N > MAN_VIS ? (h - thumb) * man_top / (MAN_N - MAN_VIS) : 0u;
    lcd_fill(230, MAN_Y, 3, h, KB_RING);
    lcd_fill(230, MAN_Y + ty, 3, thumb, C_ACC);
}

static void manual_scroll(int32_t s)
{
    int32_t t = (int32_t)man_top + s, max = (int32_t)MAN_N - (int32_t)MAN_VIS;
    t = t > max ? max : t < 0 ? 0 : t;
    if ((uint32_t)t != man_top) {
        man_top = (uint32_t)t;
        ui_dirty = 1;
    }
}

static void menu_draw(int full)
{
    static uint8_t shown = 255;
    uint32_t t, r, n = menu_count(menu_tab), y = MENU_Y + n * MENU_PITCH, x = 6;   /* (y: below the last row) */
    if (full || shown != menu_tab) {                /* (a new tab: the plate drawn again, the hint changes) */
        static const char *const HM[4] = {"SELECT", "scroll", "ALGO", "tab"}, *const HR[6] = {"ALGO", "tab", "SELECT", "row", "K1-K4", "value"};
        lcd_fill(0, BAR_H, 240, 40u - BAR_H, C_BG);
        lcd_fill(0, 219, 240, 21, C_BG);
        lcd_fill(0, 40, PN_X0, 179, C_BG);              /* (the plate's sides) */
        lcd_fill(PN_X1, 40, 240u - PN_X1, 179, C_BG);
        menu_plate(40, 219);
        menu_hint(menu_tab == MT_MANUAL ? HM : HR, menu_tab == MT_MANUAL ? 2u : 3u);
        shown = menu_tab;
    }
    x = 10;
    for (t = 0; t < MT_COUNT; t++) {     /* the tabs: engraved, the open one in the accent, underlined */
        uint32_t w = text_w(&FONT_S, TAB_NAME[t], -1) + 10u;
        text_bc(&FONT_S, x, 23, TAB_NAME[t], t == menu_tab ? C_ACC : PN_SCREW, C_BG, w, TA_CENTER);
        lcd_fill(x, 23u + FONT_S.h + 1u, w, 2, t == menu_tab ? C_ACC : C_BG);
        x += w + 6u;
    }
    text_bc(&FONT_L, 16, 42, menu_tab == MT_MANUAL ? "Manual" : TAB_NAME[menu_tab], C_ACC, PN_BG, 200, TA_LEFT);
    lcd_fill(10, 66, 220, 1, PN_EDGE);
    if (menu_tab == MT_MANUAL) {
        manual_draw();
        return;
    }
    for (r = 0; r < n; r++)
        menu_row_draw(menu_row_at(menu_tab, r));
    if (y < 216u)
        lcd_fill(14, y, 212, 216u - y, PN_BG);     /* (the rows a longer tab had) */
}

static void menu_open(void)             /* via page_show (panel.c): the tab and row it was left at */
{
    if (ROW_TAB[menu_sel] != menu_tab)
        menu_sel = (uint8_t)menu_first(menu_tab);
    update_arm = 0;
}

static void menu_set_row(uint32_t row, int32_t s)       /* s > 0: the next value, s < 0: the previous (stopping at the ends) */
{
    if (menu_tab == MT_MANUAL)
        return;                                     /* (no row: the buttons do nothing on the manual) */
    setting_step(row, s);
}

static void setting_step(uint32_t row, int32_t s)       /* a setting's next / previous value (the menu's and GLO's rows) */
{
    int up = s > 0;
    int32_t d = s > 0 ? 1 : -1;
    switch (row) {
    case MR_LEDS: {
        int32_t v = (int32_t)cfg.leds + d;
        cfg.leds = (uint8_t)(v < 0 ? 0 : v > 2 ? 2 : v);
        leds_avail();
        break;
    }
    case MR_ACCEL: cfg.accel = (uint8_t)up; break;
    case MR_KEYLEDS:
        cfg.key_leds = (uint8_t)up;
        cfg_dirty = 1;
        cfg_dirty_ms = fm1_ms;
        break;
    case MR_LANG:                                   /* KITTEN RACK: the language; the whole screen again */
        if (cfg.lang != (uint8_t)up) {
            cfg.lang = (uint8_t)up;
            settings_store();                       /* (kept at once: no SAVE needed) */
        }
        ui_dirty = 2;
        return;
    case MR_CH: {
        int32_t v = (int32_t)cfg.ch + d;
        cfg.ch = (uint8_t)(v < 0 ? 0 : v > 16 ? 16 : v);
        break;
    }
    case MR_CLOCK: cfg.clock_in = (uint8_t)up; break;
    case MR_MOUT: cfg.midi_out = (uint8_t)up; break;
    case MR_CLICK: case MR_CLICKLVL: case MR_RMODE: case MR_RBARS: case MR_RSTART: case MR_RQUANT: rec_step(row, s); break;
    case MR_UPDATE:
    case MR_DEFAULTS:
        if (!up)
            break;
        if (test_input_recent()) {                  /* the device test mode (#291): a script never wipes or leaves the FM-1 */
            update_arm = 0;
            ui_msg("TEST INPUT: REFUSED", 2000);
            break;
        }
        if (update_arm && fm1_ms - (update_arm & ~1u) < 3000u) {
            update_arm = 0;
            if (row == MR_UPDATE)
                update_only("FROM THE MENU");
            else
                defaults_now();
        } else {
            update_arm = fm1_ms | 1u;
        }
        break;
    default: break;
    }
    ui_dirty = 1;
}

static void menu_move(int32_t s)                        /* SELECT: the next / previous row of the tab */
{
    uint32_t n = menu_count(menu_tab), k = menu_pos(menu_sel);
    if (!n)
        return;
    k = (k + (s > 0 ? 1u : n - 1u)) % n;
    menu_sel = (uint8_t)menu_row_at(menu_tab, k);
    update_arm = 0;
    ui_dirty = 1;
}

static void menu_tab_go(int32_t s)                      /* ALGORITHM: the next / previous tab */
{
    uint32_t t = (menu_tab + (s > 0 ? 1u : MT_COUNT - 1u)) % MT_COUNT;
    menu_tab = (uint8_t)t;
    menu_sel = (uint8_t)menu_first(t);
    update_arm = 0;
    ui_dirty = 1;
}

/* the knobs while the menu is open: st[] as in knobs_poll */
static void menu_knobs(const int32_t *st)
{
    uint32_t k;
    if (st[1])
        menu_tab_go(st[1]);
    if (menu_tab == MT_MANUAL) {                    /* the manual: SELECT scrolls */
        manual_scroll(st[0]);
        return;
    }
    if (st[0])                                      /* SELECT: the rows (PRESET steps the patches, panel.c) */
        menu_move(st[0]);
    for (k = 0; k < 4u; k++)
        if (st[2u + k])
            menu_set_row(menu_sel, st[2u + k]);
}

/* the CPU load (SYSTEM's CPU and CPU PEAK rows): the peak ISR time of the last half second, in % of the 128 frame half
 * buffer (2.9 ms). On an idle SYSTEM tab only the two values are redrawn, not the page (#146). */
static void cpu_poll(void)
{
    static uint32_t t0;
    uint32_t pct, peak = cpu_peak;
    int shown;
    if (fm1_ms - t0 < 500u)
        return;
    t0 = fm1_ms;
    pct = eng_us_max * 100u / 2902u;
    if (eng_us_max > diag_us_peak)
        diag_us_peak = eng_us_max;
    eng_us_max = 0;
    if (pct > 999u)
        pct = 999u;
    if (pct > cpu_peak)
        cpu_peak = pct;
    shown = page == PAGE_MENU && menu_tab == MT_SYSTEM && !ui_dirty;   /* (a pending redraw shows them anyway) */
    if (pct != cpu_pct) {
        cpu_pct = pct;
        if (shown)
            menu_value_draw(MR_CPU);
    }
    if (cpu_peak != peak && shown)
        menu_value_draw(MR_PEAK);
}

/* the battery on screen (ui.c ui_battery set it): by the loop's drawing (panel_draw), never by a key. LOW BATTERY in the
 * bar once, the cell in the top bar when its level changed, MENU > SYSTEM > BATTERY's value when the reading changed */
static void batt_draw(void)
{
    static int32_t raw_shown = -1;
    static uint8_t lvl_shown = BATT_NONE - 1u;
    if (booting)
        return;
    if (batt_low_due) {
        batt_low_due = 0;
        ui_msg("LOW BATTERY", 3000);
    }
    batt_mark_sync();
    if (batt_raw() != raw_shown || batt_shown() != lvl_shown) {
        raw_shown = batt_raw();
        lvl_shown = batt_shown();
        if (page == PAGE_MENU && menu_tab == MT_SYSTEM && !ui_dirty)   /* (a pending redraw shows it anyway) */
            menu_value_draw(MR_BATT);
    }
}
