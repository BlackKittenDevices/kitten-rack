/* SPDX-License-Identifier: GPL-3.0-only */
/* KITTEN RACK: any module out of a patch on the FM-1 (patch_edit.h pe_module_del), on every factory patch of the bank
 * and of Matryoshka's, every module in turn: the binary still a patch (proto.c's check), the engine loads it, one module
 * fewer, no cable left on it. With a directory: the binaries written there (web/scripts/patch-del-check.ts compares
 * them with the editor's removeModule).   tools/patch_del_test.sh [DIR] */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "../src/engine.c"
#ifdef BANK_MATRYOSHKA
#include "presets_matryoshka.h"                /* (Matryoshka's: morph, routes, ranges, Drum maps, patterns, assemblies) */
#else
#include "../src/presets.h"
#endif
#include "../src/patch_edit.h"
#include "../src/patch_check.h"

#define CAP 3840u
static uint8_t bin[CAP];

int main(int argc, char **argv)
{
    uint32_t k, m, dels = 0, refused = 0, fails = 0;
    for (k = 0; k < N_PRESETS; k++) {
        uint32_t len0 = PRESET_LIST[k].len, n;
        memcpy(bin, PRESET_LIST[k].data, len0);
        if (eng_upgrade(bin, &len0, CAP))
            continue;
        n = bin[2];
        for (m = 0; m < n; m++) {
            uint32_t len = len0, i, ok = 1;
            int rc;
            memcpy(bin, PRESET_LIST[k].data, PRESET_LIST[k].len);
            len = PRESET_LIST[k].len;
            (void)eng_upgrade(bin, &len, CAP);
            rc = pe_module_del(bin, &len, m);
            if (rc == -4) {
                refused++;
                continue;
            }
            if (rc) {
                printf("FAIL %s - module %u: %d\n", PRESET_LIST[k].name, (unsigned)m, rc);
                fails++;
                continue;
            }
            dels++;
            ok &= bin[2] == n - 1u;
            ok &= m1_check(bin, len) == 0;
            ok &= eng_load(bin, len) == 0;
            for (i = 0; ok && i < (uint32_t)eng_ncables(); i++) {
                uint32_t f, fp, t, tp;
                eng_cable(i, &f, &fp, &t, &tp);
                ok &= f < n - 1u && t < n - 1u;
            }
            if (!ok) {
                printf("FAIL %s - module %u: check %d load %d\n", PRESET_LIST[k].name, (unsigned)m, m1_check(bin, len), eng_load(bin, len));
                fails++;
            }
            if (argc > 1) {
                char path[512];
                FILE *f;
                snprintf(path, sizeof path, "%s/%02u-%02u.bin", argv[1], (unsigned)k, (unsigned)m);
                f = fopen(path, "wb");
                fwrite(bin, 1, len, f);
                fclose(f);
            }
        }
    }
    {   /* KITTEN RACK: a patch with a MIDI map (ENG_FLAG_MIDIMAP): an entry per module (cc = its index); out with a module go
         * its entries, the others follow their modules down; the engine reads the rest */
        uint32_t mapped = 0;
        for (k = 0; k < N_PRESETS; k++) {
            uint32_t len0 = PRESET_LIST[k].len, n, e;
            memcpy(bin, PRESET_LIST[k].data, len0);
            if (eng_upgrade(bin, &len0, CAP) || len0 + 1u + 4u * bin[2] > CAP || bin[2] > 32u)
                continue;
            n = bin[2];
            bin[7] |= ENG_FLAG_MIDIMAP;
            bin[len0] = (uint8_t)n;
            for (e = 0; e < n; e++) {
                bin[len0 + 1u + 4u * e] = (uint8_t)e;
                bin[len0 + 2u + 4u * e] = (uint8_t)(e & 1u ? 0u : 1u + e % 16u);
                bin[len0 + 3u + 4u * e] = (uint8_t)e;
                bin[len0 + 4u + 4u * e] = 0;
            }
            len0 += 1u + 4u * n;
            if (m1_check(bin, len0) || eng_load(bin, len0)) {
                printf("FAIL %s with a MIDI map: check %d load %d\n", PRESET_LIST[k].name, m1_check(bin, len0), eng_load(bin, len0));
                fails++;
                continue;
            }
            uint32_t had = 0, n0 = 0, ch0, cc0, mod0, par0;
            for (e = 0; eng_ccmap_get(e, &ch0, &cc0, &mod0, &par0); e++, n0++)
                had |= 1u << cc0;                       /* (the entries the engine took: not a module without parameters) */
            for (m = 0; m < n; m++) {
                static uint8_t b2[CAP];
                uint32_t len = len0, ch, cc, mod, par, cnt = 0, ok = 1;
                memcpy(b2, bin, len0);
                if (pe_module_del(b2, &len, m))
                    continue;
                ok &= m1_check(b2, len) == 0 && eng_load(b2, len) == 0;
                for (e = 0; ok && eng_ccmap_get(e, &ch, &cc, &mod, &par); e++, cnt++)
                    ok &= cc != m && mod == (cc > m ? cc - 1u : cc);
                ok &= cnt == n0 - (had >> m & 1u);
                if (!ok) {
                    printf("FAIL %s with a MIDI map - module %u\n", PRESET_LIST[k].name, (unsigned)m);
                    fails++;
                }
                mapped++;
            }
        }
        printf("MIDI map through deletes: %u\n", (unsigned)mapped);
    }
    {   /* KITTEN RACK: a patch with its notes' timing (ENG_FLAG_TIMING): a module out, the slices of its track go with it,
         * the others follow their tracks down; the engine reads the rest */
        uint32_t timed = 0;
        for (k = 0; k < N_PRESETS; k++) {
            uint32_t len0 = PRESET_LIST[k].len, e, t, nb = 0, at, need = 1;
            int st;
            memcpy(bin, PRESET_LIST[k].data, len0);
            if (eng_upgrade(bin, &len0, CAP) || eng_load(bin, len0) || (st = eng_steps_module(0)) < 0)
                continue;
            for (t = 0; t < 16u && eng_steps_module(t) >= 0; t++)
                if (eng_pattern_notes((uint32_t)eng_steps_module(t), 0, &(const uint32_t *){0}) > 0)
                    need += 3u + 2u * (uint32_t)eng_pattern_notes((uint32_t)eng_steps_module(t), 0, &(const uint32_t *){0});
            if (len0 + need > CAP || (bin[7] & ENG_FLAG_TIMING))
                continue;
            at = len0 + 1u;
            for (t = 0; t < 16u && eng_steps_module(t) >= 0; t++) {   /* each track's first pattern: every note 1 + t / 64 late */
                const uint32_t *w;
                int n = eng_pattern_notes((uint32_t)eng_steps_module(t), 0, &w);
                if (n <= 0)
                    continue;
                bin[at] = (uint8_t)eng_steps_module(t);
                bin[at + 1u] = 0;
                bin[at + 2u] = (uint8_t)n;
                for (e = 0; e < (uint32_t)n; e++) {
                    bin[at + 3u + 2u * e] = (uint8_t)(1u + t);
                    bin[at + 4u + 2u * e] = 0;
                }
                at += 3u + 2u * (uint32_t)n;
                nb++;
            }
            if (!nb)
                continue;
            bin[len0] = (uint8_t)nb;
            bin[7] |= ENG_FLAG_TIMING;
            len0 = at;
            if (m1_check(bin, len0) || eng_load(bin, len0)) {
                printf("FAIL %s with timing: check %d load %d\n", PRESET_LIST[k].name, m1_check(bin, len0), eng_load(bin, len0));
                fails++;
                continue;
            }
            for (m = 0; m < bin[2]; m++) {
                static uint8_t b2[CAP];
                uint32_t len = len0, ok = 1;
                memcpy(b2, bin, len0);
                if (pe_module_del(b2, &len, m))
                    continue;
                ok &= m1_check(b2, len) == 0 && eng_load(b2, len) == 0;
                for (t = 0; ok && t < 16u && eng_steps_module(t) >= 0; t++) {
                    const uint16_t *tw;
                    int n = eng_pattern_tims((uint32_t)eng_steps_module(t), 0, &tw);
                    ok &= n <= 0 || tw[0] != 0u;            /* (each track left keeps its timing) */
                }
                if (!ok) {
                    printf("FAIL %s with timing - module %u\n", PRESET_LIST[k].name, (unsigned)m);
                    fails++;
                }
                timed++;
            }
        }
        printf("timing through deletes: %u\n", (unsigned)timed);
    }
    printf("patch deletes %s: %u modules taken out, %u refused (Main, the Output, a poly group's)\n", fails ? "FAILED" : "ok", (unsigned)dels, (unsigned)refused);
    return fails ? 1 : 0;
}
