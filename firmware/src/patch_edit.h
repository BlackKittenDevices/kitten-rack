/* SPDX-License-Identifier: GPL-3.0-only */
/* KITTEN RACK: patching on the FM-1 (rack_ui.c). Edits of a patch binary in today's format (ENG_PATCH_VERSION, which
 * proto.c m1_set_current upgrades the running patch to): a cable added or removed, a module added at the end of the
 * list, the last module removed. Shared by the device and the host tests (patch_edit_test.c). Needs engine.c (the
 * section walkers) and defs.h (RK_KEYS_IN / RK_KEYS_OUT).
 *
 * What a module brings to the binary (patchbin.ts encodePatch): its group byte (with poly groups: 0, it runs once), its
 * record (defaults, attenuverters 1, no pins), its morph B values (the defaults), its morph bit (a mask byte more every 8
 * modules), its switched fixed-links byte, a plain device (u8 0, u8 index) and its extras (no track, no structure, no
 * preset name, no rows, itself as the member). Module indices of the others never change: an added module is the last,
 * and only the last can go. Each edit returns 0 or a negative code with the binary unchanged:
 *   -1 not today's format, malformed or not allowed; -2 it would not fit the buffer; -3 a limit of the FM-1 (modules,
 *   cables, devices); -4 the cable is there already, or the last module is not one that can go plainly. */

#define PE_DEV_MAX 32u                                 /* patchbin.ts MAX_DEVICES */
#define PE_EXTRA_REC 9u                                /* a plain module's device extras */

static int pe_today(const uint8_t *p, uint32_t len) { return len >= 8u && p[0] == 0xA1u && p[1] == ENG_PATCH_VERSION; }
static uint32_t pe_ncab(const uint8_t *p) { return (uint32_t)p[4] | (uint32_t)p[5] << 8; }
static void pe_set_ncab(uint8_t *p, uint32_t n)
{
    p[4] = (uint8_t)n;
    p[5] = (uint8_t)(n >> 8);
}
static void pe_close_gap(uint8_t *p, uint32_t len, uint32_t at, uint32_t n)   /* bytes at+n..len move down by n */
{
    uint32_t k;
    for (k = at; k + n < len; k++)
        p[k] = p[k + n];
}

/* where the sections a module touches sit: records end, cables end (the morph B set and bits included), the fixed
 * links, the device pages (start, end) and the extras (end); 0 for one the patch has not got. 0 = malformed */
typedef struct { uint32_t rec, cab, fix, dev0, dev1, ext1, npar; } pe_map_t;
static int pe_map(const uint8_t *p, uint32_t len, pe_map_t *m)
{
    uint32_t at;
    m->fix = m->dev0 = m->dev1 = m->ext1 = 0;
    if (!(m->rec = eng_records_end(p, len, &m->npar)) || !(m->cab = eng_cables_end(p, len)))
        return 0;
    at = m->cab;
    if (p[6] & 4u) {
        m->fix = at;
        at += p[2];
    }
    if ((p[6] & 8u) && !(at = eng_routes_end(p, len, at)))
        return 0;
    if (!(at = eng_steps_end(p, len, at)))
        return 0;
    if (p[6] & 32u) {
        m->dev0 = at;
        if (!(m->dev1 = eng_devices_end(p, len, at)))
            return 0;
        if ((p[7] & ENG_FLAG_EXTRAS) && !(m->ext1 = eng_extras_end(p, len, m->dev1)))
            return 0;
    }
    return 1;
}

/* the cable from output `fo` of module `from` to input `ti` of module `to` (keys only into keys, as patch.ts kindsFit) */
static int pe_cable_add(uint8_t *p, uint32_t *len, uint32_t cap, uint32_t from, uint32_t fo, uint32_t to, uint32_t ti)
{
    uint32_t at, n, i;
    int tf, tt;
    if (!pe_today(p, *len) || from == to || from >= p[2] || to >= p[2])
        return -1;
    tf = eng_type_at(p, *len, from);
    tt = eng_type_at(p, *len, to);
    if (tf < 0 || tt < 0 || fo >= DEFS[tf].nout || ti >= DEFS[tt].nin || (RK_KEYS_OUT[tf] >> fo & 1u) != (RK_KEYS_IN[tt] >> ti & 1u))
        return -1;
    if (!(at = eng_records_end(p, *len, 0)))
        return -1;
    n = pe_ncab(p);
    if (at + 4u * n > *len)
        return -1;
    for (i = 0; i < n; i++)
        if (p[at + 4u * i] == from && p[at + 4u * i + 1u] == fo && p[at + 4u * i + 2u] == to && p[at + 4u * i + 3u] == ti)
            return -4;
    if (n >= ENG_MAX_CABLES)
        return -3;
    if (*len + 4u > cap)
        return -2;
    at += 4u * n;
    eng_open_gap(p, *len, at, 4u);
    p[at] = (uint8_t)from;
    p[at + 1u] = (uint8_t)fo;
    p[at + 2u] = (uint8_t)to;
    p[at + 3u] = (uint8_t)ti;
    *len += 4u;
    pe_set_ncab(p, n + 1u);
    return 0;
}

/* cable i of the patch (eng_cable's numbering: the binary's order) */
static int pe_cable_del(uint8_t *p, uint32_t *len, uint32_t i)
{
    uint32_t at;
    if (!pe_today(p, *len) || i >= pe_ncab(p) || !(at = eng_records_end(p, *len, 0)) || at + 4u * pe_ncab(p) > *len)
        return -1;
    at += 4u * i;
    pe_close_gap(p, *len, at, 4u);
    *len -= 4u;
    pe_set_ncab(p, pe_ncab(p) - 1u);
    return 0;
}

/* a module of `type` at the end of the list, its parameters at their defaults; its index is the old count */
static int pe_module_add(uint8_t *p, uint32_t *len, uint32_t cap, uint32_t type)
{
    pe_map_t m;
    const def_t *d;
    uint32_t n, grow, rs, mb, mm, at, j, g;
    if (!pe_today(p, *len) || type >= N_TYPES || type == T_FM1 || type == T_OUTPUT || !pe_map(p, *len, &m))
        return -1;
    d = &DEFS[type];
    if (d->ndata)
        return -1;                                     /* (a Steps track or a Drum map needs the editor) */
    n = p[2];
    g = p[3];
    if (n + 1u > ENG_MAX_MODULES || (m.dev0 && p[m.dev0] >= PE_DEV_MAX))
        return -3;
    rs = eng_record_size(d, ENG_PATCH_VERSION);
    mb = m.rec + 4u * pe_ncab(p) + ((p[6] & 1u) ? 4u * m.npar : 0u);   /* the end of the morph B set */
    mm = (p[7] & ENG_FLAG_MORPH_MODULES) && (n & 7u) == 0u;             /* the morph bits need a byte more */
    grow = (g ? 1u : 0u) + rs + ((p[6] & 1u) ? 4u * d->npar : 0u) + mm + (m.fix ? 1u : 0u) + (m.dev0 ? 2u : 0u) + (m.ext1 ? PE_EXTRA_REC : 0u);
    if (*len + grow > cap)
        return -2;
    /* from the end of the binary to its start, so each offset found above still holds when its turn comes */
    if (m.ext1) {
        static const uint8_t rec[PE_EXTRA_REC - 1u] = {ENG_NO_TRACK, 0, 0, 0, 0, 0, 0, 1};
        eng_open_gap(p, *len, m.ext1, PE_EXTRA_REC);
        *len += PE_EXTRA_REC;
        for (j = 0; j < PE_EXTRA_REC - 1u; j++)
            p[m.ext1 + j] = rec[j];
        p[m.ext1 + PE_EXTRA_REC - 1u] = (uint8_t)n;
        p[m.dev1]++;                                   /* the extras' count (they start where the device pages end) */
    }
    if (m.dev0) {
        eng_open_gap(p, *len, m.dev1, 2u);
        *len += 2u;
        p[m.dev1] = 0;
        p[m.dev1 + 1u] = (uint8_t)n;
        p[m.dev0]++;
    }
    if (m.fix) {
        eng_open_gap(p, *len, m.fix + n, 1u);
        *len += 1u;
        p[m.fix + n] = 0;
    }
    if (mm) {
        eng_open_gap(p, *len, m.cab, 1u);
        *len += 1u;
        p[m.cab] = 0;
    }
    if (p[6] & 1u) {
        eng_open_gap(p, *len, mb, 4u * d->npar);
        *len += 4u * d->npar;
        for (j = 0; j < d->npar; j++)
            eng_put32(p + mb + 4u * j, d->pdef[j]);
    }
    at = m.rec;
    eng_open_gap(p, *len, at, rs);
    *len += rs;
    for (j = 0; j < rs; j++)
        p[at + j] = 0;
    p[at++] = (uint8_t)type;
    for (j = 0; j < d->npar; j++, at += 4u)
        eng_put32(p + at, d->pdef[j]);
    if (d->cvbase >= 0) {
        eng_put32(p + at, ENG_ONE);                    /* the attenuverters of p1 and p2: 1; the pin masks stay 0 */
        eng_put32(p + at + 4u, ENG_ONE);
    }
    if (g) {
        at = 8u + ENG_GROUP_REC * g + n;
        eng_open_gap(p, *len, at, 1u);
        *len += 1u;
        p[at] = 0;
    }
    p[2] = (uint8_t)(n + 1u);
    return 0;
}

/* the last module out again, with its cables: only one that pe_module_add's way of adding left plain (its device the
 * last, plain, its extras as added). The sections that name modules by index (ranges, routes, notes, buttons, names,
 * patterns) are not searched: the caller pops only modules it added itself (rack_ui.c), which none of them name */
static int pe_module_pop(uint8_t *p, uint32_t *len)
{
    pe_map_t m;
    const def_t *d;
    uint32_t n, i, rs, mb, mm, at, g, k;
    int t;
    if (!pe_today(p, *len) || p[2] < 3u || !pe_map(p, *len, &m))
        return -1;
    n = p[2] - 1u;                                     /* the module that goes */
    g = p[3];
    if ((t = eng_type_at(p, *len, n)) < 0 || t == T_FM1 || t == T_OUTPUT)
        return -4;
    if (g && p[8u + ENG_GROUP_REC * g + n] != 0u)
        return -4;
    for (k = 0; k < g; k++)                            /* (a group whose notes come from it) */
        if (p[8u + ENG_GROUP_REC * k + 4u + 5u * ENG_MAX_PARTS] == n + 1u)
            return -4;
    if (m.dev0) {                                      /* its device: the last, plain, its own */
        if (m.dev1 < m.dev0 + 3u || p[m.dev1 - 2u] != 0u || p[m.dev1 - 1u] != n)
            return -4;
        if (m.ext1) {
            static const uint8_t rec[PE_EXTRA_REC - 1u] = {ENG_NO_TRACK, 0, 0, 0, 0, 0, 0, 1};
            if (m.ext1 < m.dev1 + 1u + PE_EXTRA_REC)
                return -4;
            for (k = 0; k < PE_EXTRA_REC - 1u; k++)
                if (p[m.ext1 - PE_EXTRA_REC + k] != rec[k])
                    return -4;
            if (p[m.ext1 - 1u] != n)
                return -4;
        }
    }
    d = &DEFS[t];
    for (i = pe_ncab(p); i-- > 0u;) {                  /* its cables (each one moves only what follows it) */
        at = m.rec + 4u * i;
        if (p[at] == n || p[at + 2u] == n) {
            pe_close_gap(p, *len, at, 4u);
            *len -= 4u;
            pe_set_ncab(p, pe_ncab(p) - 1u);
            m.cab -= 4u;
            if (m.fix) m.fix -= 4u;
            if (m.dev0) m.dev0 -= 4u, m.dev1 -= 4u;
            if (m.ext1) m.ext1 -= 4u;
        }
    }
    rs = eng_record_size(d, ENG_PATCH_VERSION);
    mm = (p[7] & ENG_FLAG_MORPH_MODULES) && (n & 7u) == 0u;
    mb = m.rec + 4u * pe_ncab(p) + ((p[6] & 1u) ? 4u * m.npar : 0u);
    if (m.ext1) {
        pe_close_gap(p, *len, m.ext1 - PE_EXTRA_REC, PE_EXTRA_REC);
        *len -= PE_EXTRA_REC;
        p[m.dev1]--;
    }
    if (m.dev0) {
        pe_close_gap(p, *len, m.dev1 - 2u, 2u);
        *len -= 2u;
        p[m.dev0]--;
    }
    if (m.fix) {
        pe_close_gap(p, *len, m.fix + n, 1u);
        *len -= 1u;
    }
    if (mm) {
        pe_close_gap(p, *len, m.cab - 1u, 1u);
        *len -= 1u;
    }
    if (p[6] & 1u) {
        pe_close_gap(p, *len, mb - 4u * d->npar, 4u * d->npar);
        *len -= 4u * d->npar;
    }
    pe_close_gap(p, *len, m.rec - rs, rs);
    *len -= rs;
    if (g) {
        pe_close_gap(p, *len, 8u + ENG_GROUP_REC * g + n, 1u);
        *len -= 1u;
    }
    p[2] = (uint8_t)n;
    return 0;
}
