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

/* KITTEN RACK: any module out (the rack page's QUITAR MODULO, the user 2026-10-29), with its cables, its device and what
 * names it; every later module one index down in every section that names modules (groups' note sources, group bytes,
 * cables, the morph B set and bits, fixed links, routes, the tracks' notes, patterns, the device pages, their extras, the
 * buttons, the Drum maps' names, the ranges). Not Main or the Output, nor a member of a poly group, nor a module an
 * assembly's device lists (those the editor removes): -4. A group whose notes came from it takes them from its source. The binary only shrinks, so it is rewritten in
 * place front to back (w never passes r). */
static uint32_t pe_ren(uint32_t i, uint32_t k) { return i > k ? i - 1u : i; }
static int pe_module_del(uint8_t *p, uint32_t *len, uint32_t k)
{
    uint32_t n, g, ncab, r, w, i, j, c, at, dk = 0xFFu, nd = 0, ext = 0, keepc = 0, newsrc = 0;
    uint8_t ty[ENG_MAX_MODULES];
    int t;
    const uint32_t ver = p[1];
    if (!pe_today(p, *len) || k >= p[2] || !eng_cables_end(p, *len))
        return -1;
    n = p[2];
    g = p[3];
    if ((t = eng_type_at(p, *len, k)) < 0 || t == T_FM1 || t == T_OUTPUT)
        return -4;
    if (g && p[8u + ENG_GROUP_REC * g + k] != 0u)
        return -4;
    {   /* a group playing k's notes (an Arpeggiator or a Steps track): it takes them from where k took its own (the Steps
         * track whose keys go into k's, else the keys) */
        uint32_t at0 = eng_records_end(p, *len, 0), nc = pe_ncab(p);
        newsrc = 0;
        for (c = 0; c < nc; c++)
            if (p[at0 + 4u * c + 2u] == k && eng_type_at(p, *len, p[at0 + 4u * c]) == T_STEPS && t == T_ARP)
                newsrc = p[at0 + 4u * c] + 1u;
    }
    {   /* the device pages: k's plain device (dk), no assembly device naming k */
        pe_map_t m;
        if (!pe_map(p, *len, &m))
            return -1;
        if (m.dev0) {
            uint32_t d, a = m.dev0 + 1u;
            nd = p[m.dev0];
            for (d = 0; d < nd; d++) {
                if (p[a] == 0u) {
                    if (p[a + 1u] == k)
                        dk = d;
                    a += 2u;
                    continue;
                }
                a = a + 2u + p[a + 1u];                        /* kind 1, its name */
                {
                    uint32_t np = p[a++], pg, rr;
                    for (pg = 0; pg < np; pg++) {
                        uint32_t nr;
                        a += 1u + p[a];                        /* its name */
                        if (p[a + 2u] == k + 1u)
                            return -4;
                        nr = p[a + 3u];
                        a += 4u;
                        for (rr = 0; rr < nr; rr++) {
                            uint32_t more = (p[a + 1u] & 0x80u) == 0u && (p[a + 1u] & ENG_ROW_MORE);
                            if (p[a] == k)
                                return -4;
                            a = a + 3u + p[a + 2u];
                            if (more) {
                                uint32_t q, na = p[a];
                                for (q = 0; q < na; q++)
                                    if (p[a + 1u + 2u * q] == k)
                                        return -4;
                                a = eng_row_more_end(p, *len, a);
                            }
                        }
                    }
                }
            }
            ext = m.ext1 != 0u;
        }
    }
    {   /* every module's type, from the binary as it is (the rewrite below reads them while records move) */
        uint32_t a = eng_records_at(p, *len);
        for (i = 0; i < n; i++) {
            ty[i] = (uint8_t)(p[a] & 0x7Fu);
            a += eng_record_size(&DEFS[ty[i]], ver);
        }
    }
    ncab = pe_ncab(p);
    r = w = 0;
#define PE_CP(nb) do { uint32_t n_ = (nb), q_; for (q_ = 0; q_ < n_; q_++) p[w++] = p[r++]; } while (0)
    PE_CP(8u);                                          /* the header (counts set at the end) */
    for (i = 0; i < g; i++) {                           /* the groups: their note source */
        uint32_t s = 8u + ENG_GROUP_REC * i + 4u + 5u * ENG_MAX_PARTS;
        PE_CP(ENG_GROUP_REC);
        if (p[s] == k + 1u)
            p[s] = (uint8_t)newsrc;
        if (p[s] > k + 1u)
            p[s]--;
    }
    if (g)                                              /* the group bytes */
        for (i = 0; i < n; i++) {
            if (i == k) r++;
            else PE_CP(1u);
        }
    PE_CP(ENG_PANEL_BYTES);
    for (i = 0; i < n; i++) {                           /* the records (a Drum map's keys source byte: 2 + a module index) */
        const def_t *d = &DEFS[p[r] & 0x7Fu];
        uint32_t rs = eng_record_size(d, ver);
        if (i == k) {
            r += rs;
            continue;
        }
        at = w;
        PE_CP(rs);
        if ((p[at] & 0x7Fu) == T_DRUMMAP && d->ndata) {
            uint8_t *src = &p[at + rs - d->ndata];
            if (*src == 2u + k) *src = 0;
            else if (*src > 2u + k) (*src)--;
        }
    }
    for (c = 0; c < ncab; c++) {                        /* the cables */
        if (p[r] == k || p[r + 2u] == k) {
            r += 4u;
            continue;
        }
        p[w] = (uint8_t)pe_ren(p[r], k);
        p[w + 1u] = p[r + 1u];
        p[w + 2u] = (uint8_t)pe_ren(p[r + 2u], k);
        p[w + 3u] = p[r + 3u];
        r += 4u;
        w += 4u;
        keepc++;
    }
    if (p[6] & 1u) {                                    /* the morph B set: each module's parameters */
        for (i = 0; i < n; i++) {
            uint32_t np = eng_npar(&DEFS[ty[i]], ver);
            if (i == k) r += 4u * np;
            else PE_CP(4u * np);
        }
        if (p[7] & ENG_FLAG_MORPH_MODULES) {            /* the bits: k's out, the later ones down */
            uint32_t nb = (n + 7u) / 8u, nb2 = (n - 1u + 7u) / 8u, bits[8] = {0}, b2;
            for (i = 0; i < nb && i < 8u; i++)
                bits[i] = p[r + i];
            r += nb;
            for (i = 0; i < nb2; i++)
                p[w + i] = 0;
            for (i = 0, b2 = 0; i < n; i++) {
                if (i == k)
                    continue;
                if ((bits[i >> 3] >> (i & 7u)) & 1u)
                    p[w + (b2 >> 3)] |= (uint8_t)(1u << (b2 & 7u));
                b2++;
            }
            w += nb2;
        }
    }
    if (p[6] & 4u)                                      /* the fixed links: a byte per module */
        for (i = 0; i < n; i++) {
            if (i == k) r++;
            else PE_CP(1u);
        }
    if (p[6] & 8u) {                                    /* the routes */
        uint32_t nr = p[r++], cw = w++, kept = 0;
        for (i = 0; i < nr; i++) {
            uint32_t mod = p[r], mb;
            if (mod >= n)
                return -1;
            mb = eng_mask_bytes(&DEFS[ty[mod]], ver);
            if (mod == k) {
                r += 2u + mb;
                continue;
            }
            p[w++] = (uint8_t)pe_ren(mod, k);
            r++;
            PE_CP(1u + mb);
            kept++;
        }
        p[cw] = (uint8_t)kept;
    }
    if (p[6] & 16u) {                                   /* the tracks' notes */
        uint32_t nt = p[r++], cw = w++, kept = 0;
        for (i = 0; i < nt; i++) {
            uint32_t mod = p[r], cnt = p[r + 1u];
            if (mod == k) {
                r += 2u + 4u * cnt;
                continue;
            }
            p[w++] = (uint8_t)pe_ren(mod, k);
            r++;
            PE_CP(1u + 4u * cnt);
            kept++;
        }
        p[cw] = (uint8_t)kept;
    }
    if (p[7] & ENG_FLAG_PATTERNS) {                     /* the patterns and songs */
        uint32_t nt, cw, kept = 0;
        PE_CP(2u);
        nt = p[r++];
        cw = w++;
        for (i = 0; i < nt; i++) {
            uint32_t mod = p[r], np = p[r + 1u], q, s = r;
            r += 2u;
            for (q = 0; q < np; q++) {
                uint32_t cnt = p[r++];
                if (cnt == 0xFFu)
                    continue;
                r += 2u + cnt * ((p[r] & 0x80u) ? 2u : 4u);
            }
            if (mod == k)
                continue;
            {
                uint32_t nb = r - s, q2;
                p[w] = (uint8_t)pe_ren(mod, k);
                for (q2 = 1; q2 < nb; q2++)
                    p[w + q2] = p[s + q2];
                w += nb;
            }
            kept++;
        }
        p[cw] = (uint8_t)kept;
        {
            uint32_t ns = p[r], s = r;
            r++;
            for (i = 0; i < ns; i++)
                r += 1u + 2u * p[r];
            for (j = s; j < r; j++)
                p[w++] = p[j];
        }
    }
    if (p[6] & 32u) {                                   /* the device pages: k's plain device out, the rest renumbered */
        uint32_t cnt = p[r++], cw = w++, d, kept = 0;
        for (d = 0; d < cnt; d++) {
            if (p[r] == 0u) {
                if (d == dk) {
                    r += 2u;
                    continue;
                }
                p[w] = 0;
                p[w + 1u] = (uint8_t)pe_ren(p[r + 1u], k);
                r += 2u;
                w += 2u;
                kept++;
                continue;
            }
            {   /* an assembly's device (none names k): its rows' modules and its displays renumbered */
                uint32_t np, pg, rr;
                PE_CP(1u);
                PE_CP(1u + p[r]);
                np = p[r];
                PE_CP(1u);
                for (pg = 0; pg < np; pg++) {
                    uint32_t nr;
                    PE_CP(1u + p[r]);
                    PE_CP(2u);
                    p[w] = p[r] > k + 1u ? (uint8_t)(p[r] - 1u) : p[r];
                    w++, r++;
                    nr = p[r];
                    PE_CP(1u);
                    for (rr = 0; rr < nr; rr++) {
                        uint32_t more = (p[r + 1u] & 0x80u) == 0u && (p[r + 1u] & ENG_ROW_MORE);
                        p[w] = (uint8_t)pe_ren(p[r], k);
                        w++, r++;
                        PE_CP(1u);
                        PE_CP(1u + p[r]);
                        if (more) {
                            uint32_t na = p[r], q, nn;
                            PE_CP(1u);
                            for (q = 0; q < na; q++) {
                                p[w] = (uint8_t)pe_ren(p[r], k);
                                w++, r++;
                                PE_CP(1u);
                            }
                            nn = p[r];
                            PE_CP(1u);
                            for (q = 0; q < nn; q++)
                                PE_CP(1u + p[r]);
                        }
                    }
                }
                kept++;
            }
        }
        p[cw] = (uint8_t)kept;
        if (ext) {                                      /* the extras: dk's out; tracks (device indices) and modules renumbered */
            uint32_t ce = p[r++], cw2 = w++, kept2 = 0;
            for (d = 0; d < ce; d++) {
                uint32_t tr = p[r], nl, nrow, nm, q;
                if (d == dk) {
                    r += 5u;
                    r += 1u + p[r];
                    r += 1u + 2u * p[r];
                    r += 1u + p[r];
                    continue;
                }
                p[w] = tr == ENG_NO_TRACK || tr == dk ? (uint8_t)ENG_NO_TRACK : (uint8_t)(dk != 0xFFu && tr > dk ? tr - 1u : tr);
                w++, r++;
                PE_CP(4u);
                nl = p[r];
                PE_CP(1u + nl);
                nrow = p[r];
                PE_CP(1u);
                for (q = 0; q < nrow; q++) {
                    if (p[r] == 0xFFu || p[r] == k) {
                        p[w] = 0xFFu;
                        p[w + 1u] = 0xFFu;
                    } else {
                        p[w] = (uint8_t)pe_ren(p[r], k);
                        p[w + 1u] = p[r + 1u];
                    }
                    r += 2u;
                    w += 2u;
                }
                nm = p[r++];
                {
                    uint32_t mw = w++, mk = 0;
                    for (q = 0; q < nm; q++, r++)
                        if (p[r] != k) {
                            p[w++] = (uint8_t)pe_ren(p[r], k);
                            mk++;
                        }
                    p[mw] = (uint8_t)mk;
                }
                kept2++;
            }
            p[cw2] = (uint8_t)kept2;
        }
    } else if (p[7] & ENG_FLAG_EXTRAS)
        return -1;
    if (p[6] & 64u) {                                   /* the buttons: a Toggle's modules, a Page button's device pages */
        uint8_t kinds[ENG_PANEL_BUTTONS];
        uint32_t b;
        for (b = 0; b < ENG_PANEL_BUTTONS; b++)
            kinds[b] = p[r + b];
        PE_CP(ENG_PANEL_BUTTONS);
        for (b = 0; b < ENG_PANEL_BUTTONS; b++) {
            uint32_t cnt, cw, kept = 0, q;
            if (kinds[b] != 2u && kinds[b] != 3u)
                continue;
            cnt = p[r++];
            cw = w++;
            for (q = 0; q < cnt; q++) {
                if (kinds[b] == 2u) {
                    if (p[r] != k) {
                        p[w++] = (uint8_t)pe_ren(p[r], k);
                        kept++;
                    }
                    r++;
                } else {
                    uint32_t dv = p[r];
                    if (dv != dk) {
                        p[w] = (uint8_t)(dk != 0xFFu && dv > dk ? dv - 1u : dv);
                        p[w + 1u] = p[r + 1u];
                        w += 2u;
                        kept++;
                    }
                    r += 2u;
                }
            }
            p[cw] = (uint8_t)kept;
        }
    }
    if (p[6] & 128u) {                                  /* the Drum maps' names */
        uint32_t nm = p[r++], cw = w++, kept = 0, rec = 1u + ENG_DRUM_ROWS * ENG_DRUM_NAME;
        for (i = 0; i < nm; i++) {
            if (p[r] == k) {
                r += rec;
                continue;
            }
            p[w] = (uint8_t)pe_ren(p[r], k);
            w++, r++;
            PE_CP(rec - 1u);
            kept++;
        }
        p[cw] = (uint8_t)kept;
    }
    if (p[6] & 2u) {                                    /* the ranges */
        uint32_t nr = p[r++], cw = w++, kept = 0;
        for (i = 0; i < nr; i++) {
            if (p[r] == k) {
                r += 5u;
                continue;
            }
            p[w] = (uint8_t)pe_ren(p[r], k);
            w++, r++;
            PE_CP(4u);
            kept++;
        }
        p[cw] = (uint8_t)kept;
    }
    if (p[7] & ENG_FLAG_MIDIMAP) {                      /* KITTEN RACK: the MIDI map: cc, channel, module, parameter */
        uint32_t nm = p[r++], cw = w++, kept = 0;
        for (i = 0; i < nm; i++, r += 4u) {
            if (p[r + 2u] == k)
                continue;
            p[w] = p[r];
            p[w + 1u] = p[r + 1u];
            p[w + 2u] = (uint8_t)pe_ren(p[r + 2u], k);
            p[w + 3u] = p[r + 3u];
            w += 4u;
            kept++;
        }
        p[cw] = (uint8_t)kept;
    }
#undef PE_CP
    if (r != *len)
        return -1;                                      /* (cannot happen with a binary that walks: the caller's copy is lost) */
    p[2] = (uint8_t)(n - 1u);
    pe_set_ncab(p, keepc);
    *len = w;
    return 0;
}
