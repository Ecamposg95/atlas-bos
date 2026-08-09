// app.jsx — entry point
// Mounts the DesignCanvas with all preset sections.

const { useState, useEffect } = React;

function App() {
  return (
    <DesignCanvas>
      <DCSection id="system" title="Sistema visual Atlas One" subtitle="Una plataforma. Once configuraciones. Mismo ADN.">
        <DCArtboard id="overview" label="00 · Tokens, tipografía, componentes base" width={1680} height={1000}>
          <SystemOverview />
        </DCArtboard>
      </DCSection>

      <DCSection id="pos" title="Atlas POS" subtitle="Preset 01 · Entrada universal · Azul tecnológico">
        <DCArtboard id="pos-desktop" label="01 · Dashboard desktop" width={1440} height={900}><PosDesktop /></DCArtboard>
        <DCArtboard id="pos-pos" label="02 · POS táctil" width={1280} height={800}><PosTouch /></DCArtboard>
        <DCArtboard id="pos-mobile" label="03 · Móvil" width={390} height={844}><PosMobile /></DCArtboard>
        <DCArtboard id="pos-hero" label="04 · Mockup comercial" width={1600} height={1000}><PosHero /></DCArtboard>
      </DCSection>

      <DCSection id="retail" title="Atlas One Retail" subtitle="Preset 02 · Inventario, SKUs y mostrador · Azul profundo + cyan">
        <DCArtboard id="retail-desktop" label="01 · Inventario desktop" width={1440} height={900}><RetailDesktop /></DCArtboard>
        <DCArtboard id="retail-pos" label="02 · Mostrador táctil" width={1280} height={800}><RetailTouch /></DCArtboard>
        <DCArtboard id="retail-mobile" label="03 · Móvil" width={390} height={844}><RetailMobile /></DCArtboard>
        <DCArtboard id="retail-hero" label="04 · Mockup comercial" width={1600} height={1000}><RetailHero /></DCArtboard>
      </DCSection>

      <DCSection id="barber" title="Atlas One Barber" subtitle="Preset 03 · Agenda, sillas y comisiones · Carbón + acero">
        <DCArtboard id="barber-desktop" label="01 · Agenda desktop" width={1440} height={900}><BarberDesktop /></DCArtboard>
        <DCArtboard id="barber-pos" label="02 · Recepción táctil" width={1280} height={800}><BarberTouch /></DCArtboard>
        <DCArtboard id="barber-mobile" label="03 · Móvil del barbero" width={390} height={844}><BarberMobile /></DCArtboard>
        <DCArtboard id="barber-hero" label="04 · Mockup comercial" width={1600} height={1000}><BarberHero /></DCArtboard>
      </DCSection>

      <DCSection id="beauty" title="Atlas One Beauty & Wellness" subtitle="Preset 04 · Citas, membresías y comisiones · Rosa elegante + champagne">
        <DCArtboard id="beauty-desktop" label="01 · Agenda desktop" width={1440} height={900}><BeautyDesktop /></DCArtboard>
        <DCArtboard id="beauty-touch" label="02 · Check-in clienta táctil" width={1280} height={800}><BeautyTouch /></DCArtboard>
        <DCArtboard id="beauty-hero" label="03 · Mockup comercial" width={1600} height={1000}><BeautyHero /></DCArtboard>
      </DCSection>

      <DCSection id="health" title="Atlas One Health" subtitle="Preset 05 · Agenda clínica y expediente · Turquesa + blanco">
        <DCArtboard id="health-desktop" label="01 · Agenda clínica desktop" width={1440} height={900}><HealthDesktop /></DCArtboard>
        <DCArtboard id="health-touch" label="02 · Ficha del paciente" width={1280} height={800}><HealthTouch /></DCArtboard>
        <DCArtboard id="health-hero" label="03 · Mockup comercial" width={1600} height={1000}><HealthHero /></DCArtboard>
      </DCSection>

      <DCSection id="restaurant" title="Atlas One Restaurant" subtitle="Preset 06 · Mesas, comandas y cocina · Naranja + carbón cálido">
        <DCArtboard id="rest-dash" label="00 · Dashboard ejecutivo" width={1440} height={900}><RestaurantDashboard /></DCArtboard>
        <DCArtboard id="rest-desktop" label="01 · Plano de mesas desktop" width={1440} height={900}><RestaurantDesktop /></DCArtboard>
        <DCArtboard id="rest-pos" label="02 · Comanda táctil" width={1280} height={800}><RestaurantTouch /></DCArtboard>
        <DCArtboard id="rest-checkout" label="05 · Caja / cierre de turno" width={1440} height={900}><RestaurantCheckout /></DCArtboard>
        <DCArtboard id="rest-checkout-tab" label="05t · Caja (tablet)" width={1194} height={834}><RestaurantCheckout /></DCArtboard>
        <DCArtboard id="rest-mobile" label="04 · KDS cocina (móvil)" width={390} height={844}><RestaurantMobile /></DCArtboard>
        <DCArtboard id="rest-dash-mob" label="00m · Dashboard del dueño (móvil)" width={390} height={844}><RestaurantDashboardMobile /></DCArtboard>
        <DCArtboard id="rest-hero" label="06 · Mockup comercial" width={1600} height={1000}><RestaurantHero /></DCArtboard>
      </DCSection>

      <DCSection id="cafe" title="Atlas One Café" subtitle="Preset 07 · Barra rápida, recetas e insumos · Espresso + ámbar">
        <DCArtboard id="cafe-desktop" label="01 · Operación desktop" width={1440} height={900}><CafeDesktop /></DCArtboard>
        <DCArtboard id="cafe-touch" label="02 · POS barra rápida" width={1280} height={800}><CafeTouch /></DCArtboard>
        <DCArtboard id="cafe-queue" label="03 · Cola de pedidos" width={1440} height={900}><CafeQueue /></DCArtboard>
        <DCArtboard id="cafe-queue-tab" label="03t · Cola (tablet)" width={1194} height={834}><CafeQueue /></DCArtboard>
        <DCArtboard id="cafe-queue-mob" label="03m · Cola (móvil)" width={390} height={844}><CafeQueueMobile /></DCArtboard>
        <DCArtboard id="cafe-recipes" label="04 · Recetas e insumos" width={1440} height={900}><CafeRecipes /></DCArtboard>
        <DCArtboard id="cafe-hero" label="05 · Mockup comercial" width={1600} height={1000}><CafeHero /></DCArtboard>
      </DCSection>

      <DCSection id="bar" title="Atlas One Bar" subtitle="Preset 08 · Barra, botellas y noche · Violeta + neón">
        <DCArtboard id="bar-desktop" label="01 · Turno noche · dark mode" width={1440} height={900}><BarDesktop /></DCArtboard>
        <DCArtboard id="bar-touch" label="02 · Barra de coctelería" width={1280} height={800}><BarTouch /></DCArtboard>
        <DCArtboard id="bar-tabs" label="03 · Cuentas abiertas" width={1440} height={900}><BarTabs /></DCArtboard>
        <DCArtboard id="bar-tabs-tab" label="03t · Cuentas (tablet)" width={1194} height={834}><BarTabs /></DCArtboard>
        <DCArtboard id="bar-hero" label="04 · Mockup comercial" width={1600} height={1000}><BarHero /></DCArtboard>
      </DCSection>

      <DCSection id="services" title="Atlas One Services" subtitle="Preset 09 · Órdenes de trabajo y seguimiento · Esmeralda + petróleo">
        <DCArtboard id="services-desktop" label="01 · Kanban de órdenes" width={1440} height={900}><ServicesDesktop /></DCArtboard>
        <DCArtboard id="services-touch" label="02 · Ficha de OT" width={1280} height={800}><ServicesTouch /></DCArtboard>
        <DCArtboard id="services-hero" label="03 · Mockup comercial" width={1600} height={1000}><ServicesHero /></DCArtboard>
      </DCSection>

      <DCSection id="enterprise" title="Atlas One Enterprise" subtitle="Preset 10 · Multisucursal, IA y gobierno · Púrpura + azul eléctrico">
        <DCArtboard id="ent-desktop" label="01 · Panel ejecutivo · dark mode" width={1440} height={900}><EnterpriseDesktop /></DCArtboard>
        <DCArtboard id="ent-touch" label="02 · Constructor de módulos" width={1280} height={800}><EnterpriseTouch /></DCArtboard>
        <DCArtboard id="ent-hero" label="03 · Mockup comercial" width={1600} height={1000}><EnterpriseHero /></DCArtboard>
      </DCSection>

      <DCSection id="custom" title="Atlas One Custom" subtitle="Preset 11 · Configuración a la medida · Neutral premium">
        <DCArtboard id="custom-desktop" label="01 · Constructor de proceso" width={1440} height={900}><CustomDesktop /></DCArtboard>
        <DCArtboard id="custom-touch" label="02 · Theming en vivo" width={1280} height={800}><CustomTouch /></DCArtboard>
        <DCArtboard id="custom-hero" label="03 · Mockup comercial" width={1600} height={1000}><CustomHero /></DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
