export const SYSTEM_MESSAGES = {
  PRODUCT_INVALIDATED: (title) => `O produto "${title}" foi marcado como inválido por violar as diretrizes da plataforma. Ele não está mais visível para os compradores.`,
  PRODUCT_DELETED: (title) => `O produto "${title}" foi excluído permanentemente da plataforma pelo administrador.`,
  BROADCAST_INFO: 'Este é um aviso oficial da UniBrik.',
}

export const UI_TEXTS = {
  CHAT_ERROR_LOAD: 'Falha ao carregar conversas.',
  CHAT_ERROR_MESSAGES: 'Falha ao carregar mensagens.',
  CHAT_ERROR_START: 'Falha ao iniciar conversa com o vendedor.',
  CHAT_DELETED_AD_BANNER: 'Este chat foi finalizado pois o anúncio foi removido.',
  CHAT_DELETED_AD_ATTACHMENT: 'Anúncio indisponível',
  CHAT_READ_ONLY: 'Conversa somente leitura.',
  CHAT_EMPTY_STATE: 'Você não tem nenhuma conversa ativa.',
  GLOBAL_UNAUTHORIZED: 'Usuário não autenticado.',
  GLOBAL_BLACKLISTED: 'Sua conta está bloqueada.',
}
