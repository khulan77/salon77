import test from "node:test";
import assert from "node:assert/strict";

test("only public Supabase Storage photos go through the optimizer", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo.supabase.co";
  const { optimizable } = await import("../lib/image");
  assert.equal(
    optimizable(
      "https://demo.supabase.co/storage/v1/object/public/salon-media/a.jpg",
    ),
    true,
  );
  assert.equal(
    optimizable("https://demo.supabase.co/storage/v1/object/sign/x.jpg"),
    false,
  );
  assert.equal(optimizable("https://media.test/salon-media/a.jpg"), false);
  assert.equal(optimizable("not a url"), false);
});
