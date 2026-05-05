// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

module shared_leaf (
    input logic clk
);
endmodule

module connected_top (
    input logic clk
);
    shared_leaf u_leaf (
        .clk(clk)
    );
endmodule

module orphan_mod (
    input logic clk
);
endmodule
