#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-only
# KITTEN RACK: any module out of a patch (firmware/src/patch_edit.h pe_module_del): firmware/test/patch_del_test.c.
set -e
cd "$(dirname "$0")/.."
mkdir -p build
gcc -O1 -Wall -Wextra -Wno-unused-function -Wno-unused-parameter -o build/patch_del_test firmware/test/patch_del_test.c -lm
build/patch_del_test "$@"
gcc -O1 -Wall -Wextra -Wno-unused-function -Wno-unused-parameter -DBANK_MATRYOSHKA -o build/patch_del_test_m firmware/test/patch_del_test.c -lm
build/patch_del_test_m
