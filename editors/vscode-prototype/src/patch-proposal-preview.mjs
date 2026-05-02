import {
  PATCH_PROPOSAL_SCHEMA_VERSION,
  PATCH_PROPOSAL_SOURCE,
  normalizePatchProposal,
} from "./patch-proposal-contract.mjs";

export const PATCH_PROPOSAL_PREVIEW_VERSION = "pccx.patchProposalPreview.v0";

const CHECKED_PATCH_PROPOSALS = Object.freeze([
  Object.freeze({
    version: PATCH_PROPOSAL_SCHEMA_VERSION,
    proposalId: "missingEndmodulePreview",
    source: PATCH_PROPOSAL_SOURCE,
    title: "Preview missing endmodule fix",
    summary: "Shows a small checked SystemVerilog syntax fix proposal for review.",
    riskLevel: "low",
    files: Object.freeze([
      Object.freeze({
        path: "fixtures/missing_endmodule.sv",
        changeKind: "modify",
        reason: "The checked fixture is missing a closing declaration.",
        hunks: Object.freeze([
          Object.freeze({
            oldStart: 1,
            oldLines: 3,
            newStart: 1,
            newLines: 4,
            preview: "@@\n module missing_endmodule;\n+endmodule",
          }),
        ]),
      }),
    ]),
    validationPlan: Object.freeze([
      "Run the VS Code adapter smoke through the approved validation proposal.",
      "Run the repository test baseline through the approved validation proposal.",
    ]),
    nonGoals: Object.freeze([
      "Do not apply the patch automatically.",
      "Do not add runtime provider calls.",
    ]),
    requiresUserReview: true,
  }),
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function proposalIdFromInput(input) {
  if (input == null) {
    return CHECKED_PATCH_PROPOSALS[0].proposalId;
  }
  if (typeof input === "string") {
    return input;
  }
  if (typeof input === "object" && typeof input.proposalId === "string") {
    return input.proposalId;
  }
  if (typeof input === "object" && typeof input.id === "string") {
    return input.id;
  }
  throw new Error("patch proposal preview accepts checked proposal IDs only");
}

function checkedProposals(options = {}) {
  return Array.isArray(options.checkedPatchProposals)
    ? options.checkedPatchProposals
    : CHECKED_PATCH_PROPOSALS;
}

export function listCheckedPatchProposals(options = {}) {
  return checkedProposals(options).map((proposal) => normalizePatchProposal(proposal));
}

export function findCheckedPatchProposalById(proposalId, options = {}) {
  if (typeof proposalId !== "string" || proposalId.trim().length === 0) {
    return null;
  }
  const proposal = checkedProposals(options).find((item) => item?.proposalId === proposalId);
  return proposal ? normalizePatchProposal(proposal) : null;
}

function yesNo(value) {
  return value === true ? "yes" : "no";
}

function previewSummary(proposal) {
  return {
    proposalId: proposal.proposalId,
    title: proposal.title,
    riskLevel: proposal.riskLevel,
    fileCount: proposal.files.length,
    hunkCount: proposal.files.reduce((count, file) => count + file.hunks.length, 0),
    validationPlanCount: proposal.validationPlan.length,
    requiresUserReview: proposal.requiresUserReview,
  };
}

export function formatPatchProposalPreview(proposal) {
  const lines = [
    "Patch Proposal Preview",
    `proposalId: ${proposal.proposalId}`,
    `title: ${proposal.title}`,
    `riskLevel: ${proposal.riskLevel}`,
    `requiresUserReview: ${yesNo(proposal.requiresUserReview)}`,
    "files:",
  ];

  for (const file of proposal.files) {
    lines.push(`- ${file.path} (${file.changeKind})`);
    lines.push(`  reason: ${file.reason}`);
    for (const hunk of file.hunks) {
      lines.push(
        `  hunk: old ${hunk.oldStart}+${hunk.oldLines} -> new ${hunk.newStart}+${hunk.newLines}`,
      );
      for (const previewLine of hunk.preview.split(/\r?\n/)) {
        lines.push(`    ${previewLine}`);
      }
    }
  }

  lines.push("validationPlan:");
  for (const item of proposal.validationPlan) {
    lines.push(`- ${item}`);
  }
  lines.push("nonGoals:");
  for (const item of proposal.nonGoals) {
    lines.push(`- ${item}`);
  }
  lines.push("safety:");
  lines.push("- appliesPatches: no");
  lines.push("- writesFiles: no");
  lines.push("- providerCalls: no");
  lines.push("- runtimeCalls: no");
  return lines.join("\n");
}

export function createPatchProposalPreview(input = null, options = {}) {
  if (input && typeof input === "object" && Object.hasOwn(input, "proposal")) {
    throw new Error("patch proposal preview accepts checked proposal IDs only");
  }
  const proposalId = proposalIdFromInput(input);
  const proposal = findCheckedPatchProposalById(proposalId, options);
  if (!proposal) {
    throw new Error(`unknown checked patch proposal: ${proposalId}`);
  }
  return {
    version: PATCH_PROPOSAL_PREVIEW_VERSION,
    kind: "patch-proposal-preview",
    proposal: clone(proposal),
    summary: previewSummary(proposal),
    previewText: formatPatchProposalPreview(proposal),
    proposalOnly: true,
    appliesPatches: false,
    writesFiles: false,
    providerCalls: false,
    runtimeCalls: false,
  };
}
