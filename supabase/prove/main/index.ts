// Router delle funzioni (come nel docker-compose di Supabase): /nome → /home/deno/functions/nome
Deno.serve(async (req) => {
  const nome = new URL(req.url).pathname.split('/')[1];
  if (!nome) return new Response(JSON.stringify({ msg: 'manca il nome' }), { status: 400 });
  const env = Deno.env.toObject();
  try {
    const worker = await EdgeRuntime.userWorkers.create({
      servicePath: `/home/deno/functions/${nome}`, memoryLimitMb: 256, workerTimeoutMs: 120000,
      noModuleCache: false, importMapPath: null, envVars: Object.entries(env),
    });
    return await worker.fetch(req);
  } catch (e) {
    return new Response(JSON.stringify({ msg: String(e) }), { status: 500 });
  }
});
