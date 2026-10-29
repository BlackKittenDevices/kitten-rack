/* SPDX-License-Identifier: GPL-3.0-only */
/* KITTEN RACK: the visualizers' tap (viz_ui.c): while one shows, the audio ISR (audio.c) puts the engine's output, mono,
 * into a ring the main loop reads (a frame torn by a write meanwhile only draws a little wrong). Shared with the host
 * builds (host_ui.h), which feed it from their own renders. */
#pragma once
#define VIZ_RING 1024u
static volatile uint8_t viz_on;
static int16_t viz_ring[VIZ_RING];
static volatile uint32_t viz_w;
static void viz_tap(const int32_t *l, const int32_t *r, uint32_t n)
{
    uint32_t i, w = viz_w;
    if (!viz_on)
        return;
    for (i = 0; i < n; i++) {
        int32_t s = (l[i] >> 2) + (r[i] >> 2);         /* (Q16 +-1 each: the mean, as 16 bit) */
        viz_ring[w] = (int16_t)(s > 32767 ? 32767 : s < -32768 ? -32768 : s);
        w = (w + 1u) & (VIZ_RING - 1u);
    }
    viz_w = w;
}
