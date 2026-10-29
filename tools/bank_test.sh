#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-only
# KITTEN RACK: the factory bank the firmware ships, on the fixed-point engine: firmware/test/bank_test.c.
set -e
cd "$(dirname "$0")/.."
mkdir -p build
gcc -O1 -Wall -Wextra -Wno-unused-function -Wno-unused-parameter -o build/bank_test firmware/test/bank_test.c -lm
build/bank_test
