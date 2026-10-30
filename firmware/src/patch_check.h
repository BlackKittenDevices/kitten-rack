/* SPDX-License-Identifier: GPL-3.0-only */
/* Whether a binary is a patch the FM-1 takes (proto.c m1_valid): every section walks and ends where the binary ends.
 * Shared by proto.c and the host tests (host_ui.h), so the rack page's edits are checked as on the device. Needs
 * engine.c / engine.h (the section walkers) and defs.h (POLY_MAX_GROUPS). */
#pragma once
/* why a binary is not a patch the FM-1 takes: 0 it is, else the check that failed (1..), for rack_ui.c's message */
static int m1_check(const uint8_t *p, uint32_t len)
{
    uint32_t at = eng_records_at(p, len);
    if (!at || p[0] != 0xA1 || (p[1] > ENG_PATCH_VERSION || p[1] < ENG_PATCH_COMPAT_VERSION) || p[3] > POLY_MAX_GROUPS)
        return 1;
    if ((p[7] & ~(ENG_FLAG_EXTRAS | ENG_FLAG_MORPH_MODULES | ENG_FLAG_PATTERNS | ENG_FLAG_MIDIMAP)) || ((p[7] & ENG_FLAG_MORPH_MODULES) && (p[1] < 36u || !(p[6] & 1u))) || ((p[7] & ENG_FLAG_PATTERNS) && p[1] < 48u) || (p[1] < 34u && p[7]) || (p[1] < 33u && (p[6] & 128u)) || (p[1] < 17u && (p[6] & 4u)) || (p[1] < 18u && (p[6] & 8u)) || (p[1] < 27u && (p[6] & 16u)) || (p[1] < 30u && (p[6] & 64u)))
        return 2;
    if (p[2] > ENG_MAX_MODULES || ((uint32_t)p[4] | (uint32_t)p[5] << 8) > ENG_MAX_CABLES)
        return 3;
    for (uint32_t g = 0; g < p[3]; g++)
        if (!eng_group_valid(p + 8u + ENG_GROUP_REC * g, p[1])) return 4;
    if (!(at = eng_cables_end(p, len)))                         /* the records (in the binary's format), cables, morph B set */
        return 5;
    if (p[6] & 4u) at += p[2];                              /* switched fixed-input links, before ranges */
    if ((p[6] & 8u) && !(at = eng_routes_end(p, len, at)))
        return 6;
    if (!(at = eng_steps_end(p, len, at)))      /* flag bit 4: the tracks' notes; flag bit 10: the patterns and songs */
        return 7;
    if ((p[6] & 32u) && !(at = eng_devices_end(p, len, at)))    /* flag bit 5: the device pages */
        return 8;
    if ((p[7] & ENG_FLAG_EXTRAS) && !(at = eng_extras_end(p, len, at)))   /* flag bit 8: the device extras */
        return 9;
    if ((p[6] & 64u) && !(at = eng_buttons_end(p, len, at)))    /* flag bit 6: the button kinds */
        return 10;
    if ((p[6] & 128u) && !(at = eng_names_end(p, len, at)))     /* flag bit 7: the Drum maps' row names */
        return 11;
    if (p[6] & 2u) {                                            /* flag bit 1: the macro ranges after that */
        if (at >= len)
            return 12;
        at += 1u + 5u * p[at];
    }
    if (p[7] & ENG_FLAG_MIDIMAP) {                              /* KITTEN RACK: the MIDI map, last */
        if (at >= len)
            return 13;
        at += 1u + 4u * p[at];
    }
    return at == len ? 0 : 99;
}
