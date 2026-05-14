import { ComingSoon, ComingSoonMeta } from '../../components/ComingSoon'

const APPOINTMENTS: ComingSoonMeta = {
  moduleKey: 'appointments',
  title: 'Agenda',
  icon: 'fa-calendar',
  category: 'Beauty',
  description: 'Calendario por profesional, cabinas y sucursales. Recordatorios automáticos a clientes y bloqueos de disponibilidad.',
  valueProps: [
    'Calendario por profesional o cabina',
    'Disponibilidad y bloqueos en tiempo real',
    'Recordatorios automáticos por SMS / WhatsApp',
    'Reserva online por el cliente final',
  ],
  upgradePrompt: 'Agenda servicios y citas con tus clientes desde Atlas One Beauty.',
}

const COMMISSIONS: ComingSoonMeta = {
  moduleKey: 'commissions',
  title: 'Comisiones',
  icon: 'fa-percent',
  category: 'Beauty',
  description: 'Cálculo automático de comisiones por servicio o venta, con reportes por profesional.',
  valueProps: [
    'Reglas por servicio o por venta',
    'Cálculo automático en cada cierre',
    'Reportes por profesional / turno',
    'Histórico exportable',
  ],
  upgradePrompt: 'Paga comisiones justas y automáticas a tu equipo.',
}

const MEMBERSHIPS: ComingSoonMeta = {
  moduleKey: 'memberships',
  title: 'Membresías',
  icon: 'fa-id-card',
  category: 'Beauty',
  description: 'Paquetes, créditos prepagados, suscripciones recurrentes y renovaciones automáticas.',
  valueProps: [
    'Paquetes y bonos prepagados',
    'Suscripciones mensuales o anuales',
    'Vencimientos y alertas de renovación',
    'Saldo visible al cliente',
  ],
  upgradePrompt: 'Vende paquetes y membresías con control profesional.',
}

const RECIPES: ComingSoonMeta = {
  moduleKey: 'recipes',
  title: 'Recetas / BOM',
  icon: 'fa-book',
  category: 'Gastro',
  description: 'Recetas con ingredientes, consumo automático de insumos y costeo real por platillo.',
  valueProps: [
    'Recetas con ingredientes y rendimiento',
    'Consumo automático de inventario al vender',
    'Costo unitario en tiempo real',
    'Margen por platillo en reportes',
  ],
  upgradePrompt: 'Conoce el costo real de cada platillo en Atlas One Gastro.',
}

const AI: ComingSoonMeta = {
  moduleKey: 'ai',
  title: 'Inteligencia Artificial',
  icon: 'fa-microchip',
  category: 'Enterprise',
  description: 'Copilotos para venta, predicción de demanda y automatizaciones inteligentes.',
  valueProps: [
    'Copiloto de ventas en el POS',
    'Predicción de demanda y stock',
    'Resúmenes ejecutivos automáticos',
    'Automatizaciones por reglas',
  ],
  upgradePrompt: 'Agrega IA a tu operación con Atlas One Enterprise.',
}

const PURCHASING: ComingSoonMeta = {
  moduleKey: 'purchasing',
  title: 'Compras',
  icon: 'fa-truck',
  category: 'Retail',
  description: 'Órdenes de compra a proveedores, recepciones, cuentas por pagar y control de cierre de pedido.',
  valueProps: [
    'Órdenes de compra a proveedores',
    'Recepciones que ingresan a inventario',
    'Cuentas por pagar y vencimientos',
    'Costos actualizados automáticamente',
  ],
  upgradePrompt: 'Controla compras y proveedores desde Atlas One Retail.',
}

export function AppointmentsComingSoon() { return <ComingSoon meta={APPOINTMENTS} /> }
export function CommissionsComingSoon()  { return <ComingSoon meta={COMMISSIONS} /> }
export function MembershipsComingSoon()  { return <ComingSoon meta={MEMBERSHIPS} /> }
export function RecipesComingSoon()      { return <ComingSoon meta={RECIPES} /> }
export function AIComingSoon()           { return <ComingSoon meta={AI} /> }
export function PurchasingComingSoon()   { return <ComingSoon meta={PURCHASING} /> }
