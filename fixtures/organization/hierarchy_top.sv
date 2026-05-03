// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

module leaf_mod (
    input logic clk
);
endmodule

module top_mod (
    input logic clk
);
    leaf_mod u_leaf (
        .clk(clk)
    );
endmodule
