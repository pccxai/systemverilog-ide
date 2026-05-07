// PCCX(TM) — reusable AI accelerator project.
// SPDX-FileCopyrightText: 2026 Hyun Woo Kim
// SPDX-License-Identifier: Apache-2.0

// Minimal fixture; not a real design.
module ok_module (
    input  logic clk,
    input  logic rst_n,
    output logic o_done
);

    always_ff @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            o_done <= 1'b0;
        end else begin
            o_done <= 1'b1;
        end
    end

endmodule
