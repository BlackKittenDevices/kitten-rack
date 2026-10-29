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
    printf("patch deletes %s: %u modules taken out, %u refused (Main, the Output, a poly group's)\n", fails ? "FAILED" : "ok", (unsigned)dels, (unsigned)refused);
    return fails ? 1 : 0;
}
