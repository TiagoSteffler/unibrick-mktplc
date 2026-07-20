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
  CONFIRM_HOME_MSG_DELETE: 'Deseja remover a mensagem da página inicial?',
  CONFIRM_AD_DELETE: 'Tem certeza que deseja excluir este anúncio? Esta ação não pode ser desfeita.',
  CONFIRM_USER_DELETE: 'Excluir perfil, anúncios e conversas deste usuário?',
  CONFIRM_CHAT_DELETE: 'Deseja ocultar todas as mensagens desta conversa? As novas mensagens enviadas ou recebidas voltarão a aparecer normalmente.',
}
