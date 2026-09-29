/**
 * Abrir uma UI nativa do sistema (share sheet, seletor de imagem, câmera) faz o app
 * reportar 'background' no AppState, o que dispararia o bloqueio biométrico do
 * RootNavigator ao voltar — mesmo sem o usuário ter saído do app de fato.
 *
 * No Android, `Share.share()` resolve a Promise assim que a intent é disparada,
 * bem antes da transição real para 'background' (que só chega via callback nativo
 * de lifecycle). Por isso não dá para "fechar" essa janela quando a Promise resolve:
 * usamos uma janela de tempo curta a partir do início da ação, suficiente para cobrir
 * a abertura do seletor do sistema e um cancelamento rápido do usuário.
 */
const GRACE_PERIOD_MS = 8000;

let trustedUntil = 0;

export function beginTrustedSystemUI(): void {
  trustedUntil = Date.now() + GRACE_PERIOD_MS;
}

export function isTrustedSystemUiOpen(): boolean {
  return Date.now() < trustedUntil;
}
