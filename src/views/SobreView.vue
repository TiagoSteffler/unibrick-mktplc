<script setup>
import appLogo from '../assets/blue-logo-1-CDTEx3Yb.png'
</script>

<template>
  <section class="grid loading-section" style="gap: 16px; margin-bottom: 24px;">
    <article class="card" style="display: flex; flex-direction: column;">
      <h1>Sobre o site</h1>
      <img :src="appLogo" alt="UniBrik" class="brand-logo" style="height: 20vh; align-self: center;" />

      <p>O <strong>UniBrik</strong> surgiu com o propósito de oferecer uma ferramenta de utilidade para a comunidade acadêmica. Atualmente, não há um canal exclusivo para que a comunidade acadêmica possam procurar e publicar produtos e/ou serviços que sejam de interesse geral - existe os grupos de WhatsApp, Facebook e outros perfis sociais, mas que nem sempre são apropriados para isso...</p>
      <p>Ele foi inicialmente idealizado em 2025, porém passou por uma completa reformulação para se tornar um web app disponível em todas as plataformas - basta ter um navegador e internet! Poste aqui o que você gostaria de vender, doar, trocar ou até mesmo dividir com outras pessoas da nossa universidade - respeitando sempre as diretrizes da plataforma.</p>
      <p>O site atualmente possui um moderador que validará os produtos anunciados na plataforma, de forma a garantir que cumpra as diretrizes abaixo.</p>

    </article>

    <article class="card">
      <h2>Termos de Uso e Diretrizes da Plataforma</h2>
      
      <div class="guidelines-accordion">
        <details>
          <summary style="gap: 18px;">1. Condições de Acesso e Privacidade de Dados</summary>
          <div class="details-content">
            <ul>
              <li><strong>Acesso Exclusivo:</strong> A utilização da plataforma é restrita à comunidade acadêmica da UFSM. O acesso é liberado unicamente por meio da autenticação via Google (Google Login), sendo estritamente obrigatório o uso de e-mails institucionais com os domínios @acad.ufsm.br, @inf.ufsm.br e @ufsm.br.</li>
              <li><strong>Gratuidade:</strong> A plataforma é 100% gratuita. Não há cobrança de taxas de adesão, comissões sobre negócios realizados ou exigência de dados bancários/financeiros em nenhuma etapa de sua utilização.</li>
              <li><strong>Tratamento de Dados:</strong> A plataforma coleta e armazena os dados de perfil inseridos no cadastro (como nome e e-mail) com a finalidade estrita de identificação do usuário e manutenção de um ambiente seguro. A privacidade e a soberania dos seus dados são prioridades; as informações não são comercializadas ou repassadas a terceiros.</li>
            </ul>
          </div>
        </details>

        <details>
          <summary style="gap: 18px;">2. Diretrizes de Publicação e Produtos Anunciados</summary>
          <div class="details-content">
            <p style="margin-bottom: 12px; margin-top: 0;">Para garantir um ambiente seguro e organizado, é terminantemente proibido anunciar, postar ou solicitar:</p>
            <ul>
              <li><strong>Itens Ilícitos:</strong> Qualquer produto, substância ou serviço cuja comercialização infrinja a legislação brasileira (ex: drogas ilícitas, armas, medicamentos controlados, produtos falsificados ou oriundos de descaminho).</li>
              <li><strong>Animais:</strong> A venda, troca ou doação de animais de qualquer espécie não é permitida na plataforma.</li>
              <li><strong>Conteúdo Falso ou Enganoso:</strong> Anúncios que contenham informações inverídicas, promessas fraudulentas ou imagens que não correspondam ao estado real do item.</li>
              <li><strong>Conteúdo Ofensivo e Violação de Privacidade:</strong> É vedada a postagem de imagens de nudez, material pornográfico, discursos de ódio, violência, ou qualquer conteúdo que exponha dados sensíveis e viole a privacidade de terceiros.</li>
              <li><strong>Spam e Desorganização:</strong> É proibida a publicação duplicada do mesmo anúncio (spam). Além disso, todos os anúncios devem ser alocados nas categorias corretas disponibilizadas pela plataforma, a fim de manter o catálogo organizado para todos os usuários.</li>
            </ul>
          </div>
        </details>

        <details>
          <summary style="gap: 18px;">3. Regras de Conduta no Chat</summary>
          <div class="details-content">
            <ul>
              <li><strong>Finalidade Exclusiva:</strong> O serviço de mensagens internas (chat) destina-se unicamente a facilitar a conexão entre as partes, permitindo o esclarecimento de dúvidas sobre o produto ou serviço e a combinação da entrega.</li>
              <li><strong>Respeito e Civilidade:</strong> O chat não deve ser utilizado para violar direitos de terceiros. São inaceitáveis comportamentos abusivos, assédio, ameaças e o compartilhamento de conteúdos de cunho racista, homofóbico, machista ou discriminatório de qualquer natureza.</li>
              <li><strong>Monitoramento e Infrações:</strong> A plataforma garante a privacidade das comunicações, porém, em caso de denúncias ou suspeitas de infração às diretrizes, a moderação reserva-se o direito de acessar o histórico de mensagens para averiguação. Tais registros poderão ser utilizados como material probatório para a tomada de providências cabíveis.</li>
            </ul>
          </div>
        </details>

        <details>
          <summary style="gap: 18px;">4. Limitação de Responsabilidade e Moderação</summary>
          <div class="details-content">
            <ul>
              <li><strong>Papel da Plataforma:</strong> O Marketplace Universitário atua como um mero facilitador de contato. A plataforma não atua como intermediária, não retém valores, não realiza transações financeiras e não garante o estado de conservação, a procedência ou a veracidade dos produtos anunciados.</li>
              <li><strong>Isenção de Responsabilidade:</strong> Toda negociação, pagamento e entrega são de inteira e exclusiva responsabilidade dos usuários envolvidos. A plataforma não se responsabiliza por eventuais perdas, danos, fraudes ou desacordos comerciais decorrentes de negócios iniciados por meio deste canal.</li>
              <li><strong>Direito de Moderação:</strong> A administração da plataforma tem o direito e o dever de monitorar o conteúdo público (anúncios). Reserva-se o direito soberano de remover postagens que não estejam em conformidade com estas diretrizes, bem como suspender ou banir permanentemente usuários que desrespeitarem as regras aqui estabelecidas, sem aviso prévio.</li>
              <li><strong>Sistema de Denúncias e Boa-Fé:</strong> A plataforma disponibiliza um mecanismo de denúncia para que a comunidade auxilie na manutenção de um ambiente seguro, permitindo relatar anúncios ou comportamentos que violem estas diretrizes e que eventualmente não tenham sido detectados de forma imediata. O uso desta ferramenta deve ser estritamente pautado pela ética e boa-fé. É expressamente proibida a utilização indevida, abusiva, repetitiva ou infundada do sistema de denúncias com o intuito de prejudicar vendedores legítimos, silenciar anúncios concorrentes, censurar publicações permitidas ou obter qualquer tipo de vantagem indevida. A exploração maliciosa deste recurso configura infração grave, sujeitando o autor das denúncias falsas às penalidades da plataforma, incluindo a suspensão ou o banimento permanente de sua própria conta.</li>
            </ul>
          </div>
        </details>
      </div>
    </article>

    <article class="card">
      <h2>Contato</h2>
      <p style="margin-bottom: 0;">Dúvidas acerca das diretrizes ou outros problemas relacionados à plataforma, entre em contato pelo email <a href="mailto:unibrikmarketplace@gmail.com" class="link">unibrikmarketplace@gmail.com</a>.</p>
    </article>
  </section>
</template>

<style scoped>
h1, h2 {
  margin-top: 0;
  margin-bottom: 12px;
}
p {
  line-height: 1.6;
}
.guidelines-accordion {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
details {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}
summary {
  padding: 16px;
  font-weight: 600;
  cursor: pointer;
  background: #f1f5f9;
  list-style: none; /* Hide default arrow in some browsers */
  display: flex;
  align-items: center;
  justify-content: space-between;
}
summary::-webkit-details-marker {
  display: none;
}
summary::after {
  content: '+';
  font-size: 1.2rem;
  color: #64748b;
  transition: transform 0.2s;
}
details[open] summary::after {
  content: '−';
}
details[open] summary {
  border-bottom: 1px solid #e2e8f0;
}
.details-content {
  padding: 16px;
  background: #ffffff;
}
.details-content ul {
  margin: 0;
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.details-content li {
  line-height: 1.5;
}
.link {
  color: #2563eb;
  text-decoration: underline;
  font-weight: 500;
}
</style>
