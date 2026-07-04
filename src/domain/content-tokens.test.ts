import { describe, expect, it } from "vitest";
import { tokenizeContent } from "./content-tokens";

describe("tokenizeContent", () => {
  it("splits urls and hashtags out of text", () => {
    expect(tokenizeContent("deploy on https://nocal.example now #dev")).toEqual([
      { type: "text", value: "deploy on " },
      { type: "url", value: "https://nocal.example" },
      { type: "text", value: " now" },
      { type: "text", value: " " },
      { type: "hashtag", value: "dev" },
    ]);
  });

  it("keeps uppercase hex colors as plain text, lowercase stays a hashtag", () => {
    expect(tokenizeContent("use #FEE here")).toEqual([{ type: "text", value: "use #FEE here" }]);
    expect(tokenizeContent("use #fee")).toEqual([
      { type: "text", value: "use" },
      { type: "text", value: " " },
      { type: "hashtag", value: "fee" },
    ]);
  });

  it("returns plain content as one token", () => {
    expect(tokenizeContent("hello world")).toEqual([{ type: "text", value: "hello world" }]);
  });
});
