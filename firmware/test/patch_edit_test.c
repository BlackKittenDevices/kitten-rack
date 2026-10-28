/* SPDX-License-Identifier: GPL-3.0-only */
/* KITTEN RACK: patching on the FM-1 (firmware/src/patch_edit.h) on every factory patch: a module of each type the rack
 * page offers added, cabled, its cable removed, the module taken out again. After each edit the engine must load the
 * binary, see what changed, and the sections must still walk to the end; adding then removing must give the bytes back.
 *   tools/patch_edit_test.sh */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "../src/engine.c"
#include "../src/presets.h"
#include "../src/patch_edit.h"

#define CAP 3840u                                      /* proto.c M1_PATCH_MAX */
static int fails;
#define CHECK(c, ...) do { if (!(c)) { printf("FAIL %s:%d ", __FILE__, __LINE__); printf(__VA_ARGS__); printf("\n"); fails++; } } while (0)

/* the binary's sections all walk and end where it ends (proto.c m1_valid's walk, the parts KITTEN RACK touches) */
static int walks(const uint8_t *p, uint32_t len)
{
    pe_map_t m;
    uint32_t at;
    if (!pe_map(p, len, &m))
        return 0;
    at = m.ext1 ? m.ext1 : m.dev1 ? m.dev1 : 0;
    if (!at) {
        at = m.cab;
        if (p[6] & 4u) at += p[2];
        if ((p[6] & 8u) && !(at = eng_routes_end(p, len, at))) return 0;
        if (!(at = eng_steps_end(p, len, at))) return 0;
    }
    if ((p[6] & 64u) && !(at = eng_buttons_end(p, len, at))) return 0;
    if ((p[6] & 128u) && !(at = eng_names_end(p, len, at))) return 0;
    if (p[6] & 2u) {
        if (at >= len) return 0;
        at += 1u + 5u * p[at];
    }
    return at == len;
}

static uint8_t bin[CAP], before[CAP];

int main(void)
{
    uint32_t k, c, edits = 0, refused = 0;
    for (k = 0; k < N_PRESETS; k++) {
        uint32_t len = PRESET_LIST[k].len, len0, n, i;
        memcpy(bin, PRESET_LIST[k].data, len);
        if (eng_upgrade(bin, &len, CAP)) {
            printf("skip %s: does not fit today's format\n", PRESET_LIST[k].name);
            continue;
        }
        CHECK(walks(bin, len), "%s does not walk before any edit", PRESET_LIST[k].name);
        memcpy(before, bin, len);
        len0 = len;
        for (c = 0; c < RK_NCAT; c++) {
            uint32_t t = RK_CAT_TYPE[c], ncab, from, fp, to, tp;
            int rc;
            n = bin[2];
            rc = pe_module_add(bin, &len, CAP, t);
            if (rc == -3 || rc == -2) {                /* (a full patch: the FM-1 says so; nothing changed) */
                CHECK(len == len0 && !memcmp(bin, before, len), "%s: a refused add changed the binary", PRESET_LIST[k].name);
                continue;
            }
            CHECK(rc == 0, "%s + %s: add %d", PRESET_LIST[k].name, RK_CAT_LABEL[c], rc);
            if (rc)
                continue;
            edits++;
            CHECK(bin[2] == n + 1u && eng_type_at(bin, len, n) == (int)t, "%s + %s: not the last module", PRESET_LIST[k].name, RK_CAT_LABEL[c]);
            CHECK(walks(bin, len), "%s + %s: the sections do not walk", PRESET_LIST[k].name, RK_CAT_LABEL[c]);
            rc = eng_load(bin, len);
            CHECK(rc == 0 || rc == -4, "%s + %s: eng_load %d", PRESET_LIST[k].name, RK_CAT_LABEL[c], rc);
            if (rc)                                    /* -4: a second delay, reverb, chorus ...: the FM-1 has one (rack_ui.c says so) */
                refused++;
            ncab = (uint32_t)eng_ncables();
            if (!rc && DEFS[t].nin) {                         /* MIDI-CV (module 0)'s first output into its first input */
                int kin = RK_KEYS_IN[t] & 1u, kout = RK_KEYS_OUT[T_FM1] & 1u;
                if (kin == kout) {
                    rc = pe_cable_add(bin, &len, CAP, 0, 0, n, 0);
                    CHECK(rc == 0 || rc == -2, "%s + %s: cable %d", PRESET_LIST[k].name, RK_CAT_LABEL[c], rc);
                    if (!rc) {
                    CHECK(pe_cable_add(bin, &len, CAP, 0, 0, n, 0) == -4, "%s: the same cable twice", PRESET_LIST[k].name);
                    CHECK(walks(bin, len) && eng_load(bin, len) == 0, "%s + %s: cabled, it does not load", PRESET_LIST[k].name, RK_CAT_LABEL[c]);
                    CHECK((uint32_t)eng_ncables() >= ncab, "%s + %s: the cable is not there", PRESET_LIST[k].name, RK_CAT_LABEL[c]);
                    for (i = 0; i < (uint32_t)eng_ncables(); i++) {
                        eng_cable(i, &from, &fp, &to, &tp);
                        if (to == n)
                            break;
                    }
                    CHECK(i < (uint32_t)eng_ncables() && from == 0 && fp == 0 && tp == 0, "%s + %s: the engine does not see the cable", PRESET_LIST[k].name, RK_CAT_LABEL[c]);
                    }
                }
            }
            if (DEFS[t].nout) {                        /* and its first output somewhere it fits: into the last module before it */
                uint32_t to2 = n - 1u;
                int tt = eng_type_at(bin, len, to2);
                if (tt >= 0 && DEFS[tt].nin && (RK_KEYS_OUT[t] & 1u) == (RK_KEYS_IN[tt] & 1u)) {
                    uint32_t nc = pe_ncab(bin);
                    int r2 = pe_cable_add(bin, &len, CAP, n, 0, to2, 0);
                    CHECK(r2 == 0 || r2 == -2 || r2 == -4, "%s + %s: cable out %d", PRESET_LIST[k].name, RK_CAT_LABEL[c], r2);
                    if (!r2)
                        CHECK(pe_cable_del(bin, &len, nc) == 0 && pe_ncab(bin) == nc, "%s + %s: cable del", PRESET_LIST[k].name, RK_CAT_LABEL[c]);
                }
            }
            rc = pe_module_pop(bin, &len);
            CHECK(rc == 0, "%s - %s: pop %d", PRESET_LIST[k].name, RK_CAT_LABEL[c], rc);
            CHECK(len == len0 && !memcmp(bin, before, len), "%s - %s: not the same bytes again", PRESET_LIST[k].name, RK_CAT_LABEL[c]);
            memcpy(bin, before, len0);
            len = len0;
        }
        {   /* a factory module is not ours to take out */
            int rc = pe_module_pop(bin, &len);
            if (rc == 0)
                CHECK(eng_load(bin, len) == 0 && walks(bin, len), "%s: popped its last, it does not load", PRESET_LIST[k].name);
        }
    }
    {   /* several added, cabled among themselves, then all taken out from the last */
        uint32_t len = PRESET_LIST[0].len, len0, j;
        memcpy(bin, PRESET_LIST[0].data, len);
        (void)eng_upgrade(bin, &len, CAP);
        memcpy(before, bin, len);
        len0 = len;
        for (j = 0; j < 6u; j++)
            CHECK(pe_module_add(bin, &len, CAP, T_OSC) == 0, "six VCOs: %u", j);
        for (j = 1; j < 6u; j++)
            CHECK(pe_cable_add(bin, &len, CAP, bin[2] - j, 0, bin[2] - j - 1u, 1) == 0, "the VCO chain: %u", j);
        CHECK(eng_load(bin, len) == 0 && walks(bin, len), "six VCOs do not load");
        for (j = 0; j < 6u; j++)
            CHECK(pe_module_pop(bin, &len) == 0, "six VCOs out: %u", j);
        CHECK(len == len0 && !memcmp(bin, before, len), "six VCOs: not the same bytes again");
    }
    printf("patch edits %s: %u modules added and taken out across %u patches (%u past a pool of the engine)\n", fails ? "FAILED" : "ok", edits, (unsigned)N_PRESETS, refused);
    return fails ? 1 : 0;
}
