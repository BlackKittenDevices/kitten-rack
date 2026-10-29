/* SPDX-License-Identifier: GPL-3.0-only */
/* KITTEN RACK: the SAVE page (page 13). SAVE opens it on the slot the running patch came from; SELECT or ALGO picks any of
 * the 64 slots (its name, or VACIO); SAVE again writes the running patch there, its sound and its sequence (the Steps
 * track lives in the patch) under its name, and the patch now belongs to that slot. Over another patch it asks first
 * (SAVE once more). HOME leaves without saving. In the menu SAVE keeps saving the settings as before (panel.c). */

#ifndef M1_NAME
#define M1_NAME 20u                                    /* (proto.c's: a slot name's length) */
#endif
static void save_state(void);                          /* main.c: the running patch into cur_preset */
static int save_slot_name(uint32_t slot, char *name);  /* main.c (the bank's header), host_ui.h: 1 + its name, 0 empty */
#define SV_ROWS 13u
#define SV_ROW_H 15u
static uint32_t sv_sel, sv_armed;                      /* the slot in focus; 1 + the slot an overwrite waits for */

/* SEL: the slot in focus loaded (LOAD), nothing saved; 1 when it was (the page closes), an empty slot says so */
static void preset_goto(uint32_t slot);
static int save_load(void)
{
    char name[M1_NAME + 1];
    if (!save_slot_name(sv_sel, name)) {
        ui_msg("LUGAR VACIO", 1200);
        return 0;
    }
    preset_goto(sv_sel);
    return 1;
}

static void save_open(void)
{
    sv_sel = cur_preset < M1_SLOTS ? cur_preset : 0u;
    sv_armed = 0;
}
static void save_turn(int32_t d)
{
    if (!d)
        return;
    sv_sel = (uint32_t)(((int32_t)sv_sel + d % (int32_t)M1_SLOTS + (int32_t)M1_SLOTS) % (int32_t)M1_SLOTS);
    sv_armed = 0;
    ui_dirty = 2;
}
/* SAVE on the page: 1 when it wrote (the caller leaves the page) */
static int save_confirm(void)
{
    char name[M1_NAME + 1];
    if (sv_sel != cur_preset && save_slot_name(sv_sel, name) && sv_armed != sv_sel + 1u) {
        sv_armed = sv_sel + 1u;                         /* another patch there: once more to write over it */
        ui_dirty = 2;
        return 0;
    }
    cur_preset = sv_sel;
    save_state();
    sv_armed = 0;
    return 1;
}
static void save_draw(int full)
{
    uint32_t k, first = sv_sel >= SV_ROWS / 2u ? sv_sel - SV_ROWS / 2u : 0u, y;
    char t[48], name[M1_NAME + 1], num[8], *q;
    (void)full;
    if (first + SV_ROWS > M1_SLOTS)
        first = M1_SLOTS - SV_ROWS;
    lcd_fill(0, 0, 240, BAR_H, P_CORAL);
    text5x7(6, 6, "GUARDAR O CARGAR", 1, P_NIGHT, P_CORAL);
    for (k = 0; k < SV_ROWS; k++) {
        uint32_t s = first + k, on = s == sv_sel, used = (uint32_t)save_slot_name(s, name);
        uint16_t bg = on ? (sv_armed == s + 1u ? 0xF800u : P_PANEL) : P_NIGHT;
        y = BAR_H + 2u + k * SV_ROW_H;
        lcd_fill(0, y, 240, SV_ROW_H, bg);
        fmt_int(num, (int32_t)s + 1);
        q = put(t, s < 9u ? "0" : "");
        q = put(q, num);
        q = put(q, s == cur_preset ? " * " : "   ");
        q = put(q, used ? name : "-- VACIO --");
        *q = 0;
        t[36] = 0;
        text5x7(8, y + 4u, t, 1, on ? P_INK : used ? P_DIM : P_FAINT, bg);
    }
    y = BAR_H + 2u + SV_ROWS * SV_ROW_H;
    lcd_fill(0, y, 240, 240u - y, P_NIGHT);
    text5x7(8, y + 3u, sv_armed ? "OTRO PATCH: SAVE DE NUEVO LO PISA" : "SAVE GUARDA  SEL CARGA  HOME SALE", 1, sv_armed ? 0xF800u : P_FAINT, P_NIGHT);
}
