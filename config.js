// Preencha com os dados do seu projeto Supabase (Project Settings → API).
// A chave pública (publishable) é pública por natureza: quem protege os dados são as regras do banco (supabase/schema.sql).
window.MT_CONFIG = {
  supabaseUrl: 'https://rihngufbfpllobmmzfgc.supabase.co',
  supabaseAnonKey: 'sb_publishable_D4hzW9_3gntO2cVeA-00yw_c_GzjJZR',
  // arquivo da versão Lite dentro do bucket privado "releases"
  // pagamentos: true depois de publicar as Edge Functions e os preços no Stripe; paymentsTest mostra o aviso de modo de teste
  paymentsEnabled: false,
  paymentsTest: true,
  liteFile: 'lite/Milens-Lite-Setup.exe'
};
