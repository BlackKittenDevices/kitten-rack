/* SPDX-License-Identifier: GPL-3.0-only */
/* KITTEN RACK: the factory bank the firmware ships (firmware/src/presets.h, from web/src/rack/factory) on the fixed-point
 * engine: every patch is today's format or upgrades to it, loads, sounds within 3 s (a key held for the ones played from
 * the keys, nothing for the ones that play themselves: they sound anyway), stays out of clipping, and takes a module and
 * a cable from the rack page (patch_edit.h) and gives them back.   tools/bank_test.sh */
#include <math.h>
#include <stdio.h>
#include <string.h>
#include "../src/engine.c"
#include "../src/presets.h"
#include "../src/patch_edit.h"

#define CAP 3840u
static uint8_t bin[CAP], keep[CAP];
static int32_t l[128], r[128];

int main(void)
{
    uint32_t k, fails = 0;
    for (k = 0; k < N_PRESETS; k++) {
        uint32_t len = PRESET_LIST[k].len, len0, b, i;
        double sum = 0, peak = 0;
        int rc;
        memcpy(bin, PRESET_LIST[k].data, len);
        if (eng_upgrade(bin, &len, CAP) || (rc = eng_load(bin, len)) != 0) {
            printf("FAIL %s: does not load\n", PRESET_LIST[k].name);
            fails++;
            continue;
        }
        eng_note_on(48, 52000, 1);
        for (b = 0; b < 3u * ENG_SR / 128u; b++) {
            eng_render(l, r, 128);
            for (i = 0; i < 128; i++) {
                double x = l[i] / 65536.0, y = r[i] / 65536.0;
                sum += x * x + y * y;
                peak = fmax(peak, fmax(fabs(x), fabs(y)));
            }
        }
        sum = sqrt(sum / (2.0 * b * 128));
        memcpy(keep, bin, len);
        len0 = len;
        rc = pe_module_add(bin, &len, CAP, T_VCA);
        if (!rc)
            rc = pe_cable_add(bin, &len, CAP, 0, 0, bin[2] - 1u, 1);
        if (!rc)
            rc = eng_load(bin, len);
        if (!rc)
            rc = pe_module_pop(bin, &len);
        printf("%s %-16s rms %.3f peak %.2f  %u B, rack edit %s\n", sum > 0.01 && peak < 1.0 && !rc && len == len0 && !memcmp(bin, keep, len) ? "ok  " : "FAIL",
               PRESET_LIST[k].name, sum, peak, len0, rc ? "refused" : "ok");
        if (!(sum > 0.01 && peak < 1.0) || rc || len != len0 || memcmp(bin, keep, len))
            fails++;
    }
    printf("factory bank %s: %u patches\n", fails ? "FAILED" : "ok", (unsigned)N_PRESETS);
    return fails ? 1 : 0;
}
