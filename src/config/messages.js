export const SYSTEM_MESSAGES = {
  PRODUCT_INVALIDATED: (title) => `O produto "${title}" foi marcado como inválido por violar as diretrizes da plataforma. Ele não está mais visível para os compradores.`,
  PRODUCT_DELETED: (title) => `O produto "${title}" foi excluído permanentemente da plataforma pelo administrador.`,
  BROADCAST_INFO: 'Este é um aviso oficial da UniBrik.',
}

export const UI_TEXTS = {
  CHAT_ERROR_LOAD: 'Falha ao carregar conversas.',
  CHAT_ERROR_MESSAGES: 'Falha ao carregar mensagens.',
  CHAT_ERROR_OLD_MESSAGES: 'Falha ao carregar mensagens antigas.',
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
  
  // Admin Panel
  ADMIN_INVALID_USER_BLACKLIST: 'Usuário inválido para blacklist.',
  ADMIN_MISSING_UID_DELETE: 'UID obrigatório para excluir dados de usuário.',
  
  // Banned / Moderation
  MODERATION_REASON_UNKNOWN: 'Não informado',
  MODERATION_STATUS_REPORTED: 'Anúncio reportado para revisão',
  
  // Products
  PRODUCT_CREATE_MISSING_PHOTO: 'Inclua pelo menos uma foto para publicar o anúncio.',
  PRODUCT_EDIT_MISSING_PHOTO: 'Inclua pelo menos uma foto para manter o anúncio ativo.',
  PRODUCT_INVALID_PRICE: 'O preço deve estar entre R$ 0,00 e R$ 9.999,99.',
  PRODUCT_NOT_FOUND: 'Anúncio não encontrado.',
  PRODUCT_LOAD_ERROR: 'Erro ao carregar produto.',
  
  // Reporting / Moderation Actions
  REPORT_FAIL: 'Falha ao reportar anúncio.',
  REPORT_SUCCESS: 'Obrigado por ajudar a manter a plataforma segura. Avaliaremos o anúncio em breve.',
  REPORT_APPROVE_FAIL: 'Falha ao aprovar anúncio.',
  REPORT_REJECT_FAIL: 'Falha ao invalidar anúncio.',
  REPORT_DELETE_FAIL: 'Falha ao excluir anúncio.',
  
  // Profile
  PROFILE_NO_GOOGLE_PHOTO: 'Nenhuma foto disponível no Google.',
  
  // Services Errors
  ERR_AUTH_VALIDATION_DELETE: 'Não foi possível validar a sessão para excluir a conta.',
  ERR_OFFLINE: 'Serviço indisponível offline.',
  ERR_CHAT_INVALID_DATA: 'Dados de conversa inválidos.',
  ERR_CHAT_SELF: 'Você não pode iniciar uma conversa consigo mesmo.',
  ERR_CHAT_UNAUTHENTICATED: 'Usuário não autenticado.',
  ERR_CHAT_INVALID_CONVERSATION: 'Conversa inválida.',
  ERR_CHAT_READ_ONLY: 'Esta conversa é somente leitura.',
  ERR_CHAT_EMPTY_MESSAGE: 'Digite uma mensagem para enviar.',
  ERR_ADMIN_RESTRICTED: 'Acesso restrito ao administrador.',
  ERR_STORAGE_UNCONFIGURED: 'Storage do Firebase não está configurado.',
  ERR_ACCOUNT_BLACKLISTED_PUBLISH: 'Sua conta está bloqueada e não pode publicar anúncios.',
  ERR_ACCOUNT_BLACKLISTED_EDIT: 'Sua conta está bloqueada e não pode editar anúncios.',
  ERR_ACCOUNT_BLACKLISTED_DELETE: 'Sua conta está bloqueada e não pode excluir anúncios.',
  ERR_PRODUCT_EDIT_UNAUTHORIZED: 'Você não tem permissão para editar este anúncio.',
  ERR_PRODUCT_EDIT_OWNER_ONLY: 'Somente anúncios criados por você podem ser editados.',
  ERR_PRODUCT_DELETE_UNAUTHORIZED: 'Você não tem permissão para excluir este anúncio.',
  ERR_PRODUCT_DELETE_OWNER_ONLY: 'Somente anúncios criados por você podem ser excluídos.',
}
