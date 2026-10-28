#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-only
# KITTEN RACK: patching on the FM-1 (firmware/src/patch_edit.h) on every factory patch: firmware/test/patch_edit_test.c.
set -e
cd "$(dirname "$0")/.."
mkdir -p build
gcc -O1 -Wall -Wextra -Wno-unused-function -Wno-unused-parameter -o build/patch_edit_test firmware/test/patch_edit_test.c -lm
build/patch_edit_test
