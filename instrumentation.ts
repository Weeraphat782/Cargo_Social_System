export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerDevScheduler } = await import("@/lib/dev-scheduler");
    registerDevScheduler();
    void import("@/lib/brands/registry")
      .then((m) => m.ensureBrandTemplatesLoaded())
      .catch((e) => console.error("[brands] template preload failed:", e));
  }
}
