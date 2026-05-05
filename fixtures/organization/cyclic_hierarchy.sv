// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 pccxai

module alpha_mod ();
    beta_mod u_beta ();
endmodule

module beta_mod ();
    alpha_mod u_alpha ();
endmodule
