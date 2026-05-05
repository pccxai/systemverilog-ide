// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

module child_mod (
    input logic clk,
    input logic rst_n,
    output logic done_o
);
endmodule

module top_mod (
    input logic clk,
    input logic rst_n,
    output logic done_o
);
    child_mod u_good (
        .clk(clk),
        .rst_n(rst_n),
        .done_o(done_o)
    );

    child_mod u_missing (
        .clk(clk),
        .extra_i(rst_n)
    );

    child_mod u_ordered (
        clk,
        rst_n,
        done_o
    );

    child_mod u_wildcard (.*);
endmodule
