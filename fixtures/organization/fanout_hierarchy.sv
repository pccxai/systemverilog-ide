// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

module fanout_leaf (
    input logic clk
);
endmodule

module fanout_child_a (
    input logic clk
);
    fanout_leaf u_leaf (
        .clk(clk)
    );
endmodule

module fanout_child_b (
    input logic clk
);
endmodule

module fanout_top (
    input logic clk
);
    fanout_child_a u_child_a (
        .clk(clk)
    );
    fanout_child_b u_child_b (
        .clk(clk)
    );
endmodule
