// Reference adapter for the cross-client spec vectors — space-probe candidate
// derivation (the reachability probe itself is I/O and not vectored).

import { describe, expect, it } from "vitest";
import vectors from "../../spec/vectors/space-detection.json";
import { spaceProbeCandidates } from "@/domain/space-probe";

describe("vectors: space-probe candidates", () => {
  it.each(vectors.candidates)("$name", ({ host, subdomains, expected }) => {
    expect(spaceProbeCandidates(host, subdomains)).toEqual(expected);
  });
});
