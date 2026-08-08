from fpdf import FPDF
from datetime import datetime

class PDFQuote(FPDF):
    def header(self):
        # Logo placeholder or Company Name
        self.set_font('Arial', 'B', 20)
        self.set_text_color(33, 37, 41) # Dark Gray
        self.cell(0, 10, 'ATLAS ERP', 0, 1, 'L')
        
        self.set_font('Arial', '', 10)
        self.set_text_color(108, 117, 125) # Gray
        self.cell(0, 5, 'Soluciones Tecnológicas y Suministros', 0, 1, 'L')
        self.ln(5)
        
        # Line break
        self.set_draw_color(200, 200, 200)
        self.line(10, 35, 200, 35)
        self.ln(10)

    def footer(self):
        self.set_y(-15)
        self.set_font('Arial', 'I', 8)
        self.set_text_color(128)
        self.cell(0, 10, f'Página {self.page_no()}', 0, 0, 'C')

def generate_quote_pdf(quote):
    pdf = PDFQuote()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)

    # --- INFO HEADER ---
    pdf.set_font("Arial", "B", 14)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(100, 10, f"COTIZACIÓN #{quote.series}-{quote.folio}", 0, 0, 'L')
    
    pdf.set_font("Arial", "", 10)
    pdf.set_text_color(50, 50, 50)
    # Right align date
    pdf.cell(90, 10, f"Fecha: {quote.created_at.strftime('%d/%m/%Y %H:%M')}", 0, 1, 'R')
    
    pdf.ln(5)

    # --- CLIENTE INFO ---
    pdf.set_fill_color(245, 247, 250) # Very light gray
    pdf.rect(10, pdf.get_y(), 190, 25, 'F')
    
    pdf.set_xy(15, pdf.get_y() + 5)
    pdf.set_font("Arial", "B", 10)
    pdf.cell(20, 5, "Cliente:", 0, 0)
    pdf.set_font("Arial", "", 10)
    customer_name = quote.customer.name if quote.customer else "Público General"
    pdf.cell(100, 5, customer_name.upper(), 0, 1)

    pdf.set_x(15)
    pdf.set_font("Arial", "B", 10)
    pdf.cell(20, 5, "RFC:", 0, 0)
    pdf.set_font("Arial", "", 10)
    pdf.cell(100, 5, (quote.customer.tax_id if quote.customer and quote.customer.tax_id else "XAXX010101000"), 0, 1)
    
    pdf.ln(15)

    # --- TABLE HEADER ---
    pdf.set_font("Arial", "B", 9)
    pdf.set_fill_color(33, 37, 41) # Dark header
    pdf.set_text_color(255, 255, 255)
    
    # Columns: SKU(30), Description(80), Qty(20), Price(30), Total(30)
    pdf.cell(30, 8, "SKU", 0, 0, 'C', True)
    pdf.cell(80, 8, "DESCRIPCIÓN", 0, 0, 'L', True)
    pdf.cell(20, 8, "CANT", 0, 0, 'C', True)
    pdf.cell(30, 8, "P. UNIT", 0, 0, 'R', True)
    pdf.cell(30, 8, "TOTAL", 0, 1, 'R', True)

    # --- TABLE BODY ---
    pdf.set_text_color(0, 0, 0)
    pdf.set_font("Arial", "", 9)
    fill = False
    
    for line in quote.lines:
        sku = "" 
        # Si tuvieras acceso al SKU desde line, úsalo. Si no, usa description o recorta.
        # Asumiendo description contiene "SKU - Nombre" como lo guardamos en quotes.py
        desc_parts = line.description.split(" - ", 1)
        sku_text = desc_parts[0] if len(desc_parts) > 1 else ""
        desc_text = desc_parts[1] if len(desc_parts) > 1 else line.description

        pdf.set_fill_color(248, 249, 250) if fill else pdf.set_fill_color(255, 255, 255)
        
        # MultiCell height handling calculation could be complex, using single line for simplicity or basic clipping
        pdf.cell(30, 8, sku_text[:14], 0, 0, 'C', fill)
        pdf.cell(80, 8, desc_text[:45], 0, 0, 'L', fill)
        pdf.cell(20, 8, str(line.quantity), 0, 0, 'C', fill)
        pdf.cell(30, 8, f"${line.unit_price:,.2f}", 0, 0, 'R', fill)
        pdf.cell(30, 8, f"${line.total_line:,.2f}", 0, 1, 'R', fill)
        
        fill = not fill
        # Dotted line separador
        pdf.set_draw_color(230,230,230)
        pdf.line(10, pdf.get_y(), 200, pdf.get_y())

    # --- TOTALS ---
    pdf.ln(5)
    pdf.set_draw_color(0,0,0)
    
    x_totals = 140
    pdf.set_x(x_totals)
    pdf.set_font("Arial", "", 10)
    pdf.cell(30, 6, "Subtotal", 0, 0, 'R')
    pdf.cell(30, 6, f"${quote.total_amount:,.2f}", 0, 1, 'R')
    
    pdf.set_x(x_totals)
    pdf.set_font("Arial", "", 10)
    pdf.cell(30, 6, "IVA (16%)", 0, 0, 'R')
    pdf.cell(30, 6, f"$0.00", 0, 1, 'R') # Assuming prices include tax or 0 tax logic for now
    
    pdf.set_x(x_totals)
    pdf.set_font("Arial", "B", 12)
    pdf.set_fill_color(240, 240, 240)
    pdf.cell(30, 10, "TOTAL", 0, 0, 'R', True)
    pdf.cell(30, 10, f"${quote.total_amount:,.2f}", 0, 1, 'R', True)

    # --- TERMS ---
    pdf.ln(20)
    pdf.set_font("Arial", "B", 9)
    pdf.cell(0, 5, "Términos y Condiciones:", 0, 1, 'L')
    pdf.set_font("Arial", "", 8)
    pdf.multi_cell(0, 4, 
        "1. Precios sujetos a cambio sin previo aviso.\n"
        "2. La vigencia de esta cotización es de 15 días naturales.\n"
        "3. En pedidos especiales se requiere el 50% de anticipo.\n"
        "4. Tiempos de entrega sujetos a disponibilidad de stock."
    )

    return bytes(pdf.output())

def generate_cash_cut_pdf(audit_data):
    """
    Genera el PDF del Corte de Caja Profesional (v3).
    Utiliza el diccionario audit_data retornado por get_session_audit_data.
    """
    pdf = PDFQuote()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)

    session = audit_data['session']
    payments = audit_data['payments']
    movements = audit_data['movements']
    kpis = audit_data['kpis']
    recon = audit_data['reconciliation']
    expected = audit_data['expected']

    # --- STYLE CONFIG ---
    primary_color = (33, 37, 41)   # Dark Slate
    accent_color = (79, 70, 229)    # Indigo 600
    green_color = (16, 185, 129)   # Emerald 500
    red_color = (239, 68, 68)      # Rose 500

    # --- TOP HEADER ---
    pdf.set_fill_color(*primary_color)
    pdf.rect(0, 0, 210, 45, 'F')
    
    pdf.set_y(12)
    pdf.set_font("Arial", "B", 24)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(0, 10, "REPORTE DE CORTE FINANCIERO", 0, 1, 'C')
    
    pdf.set_font("Arial", "", 9)
    pdf.set_text_color(180, 180, 180)
    pdf.cell(0, 6, f"SESIÓN # {session['id']}  |  {session['branch_name'].upper()}", 0, 1, 'C')
    pdf.ln(18)

    # --- INFO GRID (2 COLUMNS) ---
    pdf.set_text_color(0, 0, 0)
    y_start = pdf.get_y()
    
    # Column A
    pdf.set_font("Arial", "B", 10)
    pdf.cell(30, 6, "RESPONSABLE:", 0, 0)
    pdf.set_font("Arial", "", 10)
    pdf.cell(60, 6, session['user_name'].upper(), 0, 1)
    
    pdf.set_font("Arial", "B", 10)
    pdf.cell(30, 6, "SUCURSAL:", 0, 0)
    pdf.set_font("Arial", "", 10)
    pdf.cell(60, 6, session['branch_name'].upper(), 0, 1)

    # Column B (Dates)
    pdf.set_xy(110, y_start)
    pdf.set_font("Arial", "B", 10)
    pdf.cell(35, 6, "APERTURA:", 0, 0)
    pdf.set_font("Arial", "", 10)
    pdf.cell(50, 6, session['opened_at'].strftime('%d/%m/%Y %H:%M'), 0, 1)
    
    pdf.set_x(110)
    pdf.set_font("Arial", "B", 10)
    pdf.cell(35, 6, "CIERRE:", 0, 0)
    pdf.set_font("Arial", "", 10)
    close_str = session['closed_at'].strftime('%d/%m/%Y %H:%M') if session['closed_at'] else "EN OPERACIÓN"
    pdf.cell(50, 6, close_str, 0, 1)

    pdf.ln(12)

    # --- SUMMARY KPIs (3 Columns) ---
    pdf.set_fill_color(248, 250, 252)
    pdf.rect(10, pdf.get_y(), 190, 24, 'F')
    
    y_kpi = pdf.get_y() + 4
    pdf.set_font("Arial", "B", 8)
    pdf.set_text_color(100, 116, 139)
    
    pdf.set_xy(15, y_kpi)
    pdf.cell(60, 4, "VENTAS TOTALES (BRUTO)", 0, 0, 'C')
    pdf.cell(60, 4, "TICKETS COBRADOS", 0, 0, 'C')
    pdf.cell(60, 4, "TICKET PROMEDIO", 0, 1, 'C')
    
    pdf.set_font("Arial", "B", 16)
    pdf.set_text_color(*primary_color)
    pdf.set_x(15)
    pdf.cell(60, 10, f"${kpis['total_sales']:,.2f}", 0, 0, 'C')
    pdf.cell(60, 10, f"{kpis['total_tickets']}", 0, 0, 'C')
    pdf.cell(60, 10, f"${kpis['avg_ticket']:,.2f}", 0, 1, 'C')
    pdf.ln(10)

    # --- DETALLE POR MÉTODO ---
    pdf.set_font("Arial", "B", 10)
    pdf.set_text_color(*primary_color)
    pdf.cell(0, 10, "VENTAS POR MÉTODO DE PAGO", 0, 1)
    
    # Table Header
    pdf.set_fill_color(*accent_color)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Arial", "B", 9)
    pdf.cell(70, 8, " MÉTODO", 0, 0, 'L', True)
    pdf.cell(40, 8, "OPERACIONES", 0, 0, 'C', True)
    pdf.cell(40, 8, "IMPUESTOS", 0, 0, 'R', True)
    pdf.cell(40, 8, "MONTO TOTAL", 0, 1, 'R', True)
    
    pdf.set_text_color(51, 65, 85)
    pdf.set_font("Arial", "", 9)
    
    # Rows
    def method_row(label, data, taxes=0):
        pdf.cell(70, 8, f" {label}", 'B', 0, 'L')
        pdf.cell(40, 8, str(data['count']), 'B', 0, 'C')
        pdf.cell(40, 8, f"${taxes:,.2f}", 'B', 0, 'R')
        pdf.cell(40, 8, f"${data['total']:,.2f}", 'B', 1, 'R')

    # Itera todos los métodos que el backend expone (mismo set que el ticket
    # térmico). Antes solo se imprimían cash/card/transfer y store_credit/
    # check/others quedaban fuera del PDF aunque sí cobrados.
    _pdf_method_labels = [
        ('cash',         'Efectivo (CASH)'),
        ('card',         'Tarjeta (CARD)'),
        ('transfer',     'Transferencia (TRANSFER)'),
        ('store_credit', 'Crédito en Tienda'),
        ('check',        'Cheque'),
        ('others',       'Otros'),
    ]
    for _key, _label in _pdf_method_labels:
        _data = payments.get(_key, {"total": 0, "count": 0})
        if (_data.get('count') or 0) > 0 or (_data.get('total') or 0) > 0:
            _taxes = kpis['total_taxes'] if _key == 'cash' and _data['total'] > 0 else 0
            method_row(_label, _data, _taxes)
    
    pdf.ln(10)

    # --- ARQUEO Y CONCILIACIÓN ---
    pdf.set_font("Arial", "B", 10)
    pdf.set_text_color(*primary_color)
    pdf.cell(0, 10, "CONCILIACIÓN DE EFECTIVO (ARQUEO)", 0, 1)

    def recon_row(label, value, is_bold=False, text_color=(0,0,0)):
        pdf.set_text_color(*text_color)
        pdf.set_font("Arial", "B" if is_bold else "", 10)
        pdf.cell(140, 8, f"  {label}", 0, 0, 'L')
        pdf.cell(50, 8, f"${value:,.2f} ", 0, 1, 'R')

    recon_row("Fondo Inicial / Base de Caja", session['opening_balance'])
    recon_row("(+) Ventas Netas en Efectivo", payments['cash']['total'], text_color=green_color)
    recon_row("(+) Entradas Manuales", movements['inflows'], text_color=accent_color)
    recon_row("(-) Salidas / Gastos", movements['outflows'], text_color=red_color)

    cash_refunds = audit_data.get('returns', {}).get('cash_refunds', 0) or 0
    if cash_refunds > 0:
        returns_count = audit_data.get('returns', {}).get('count', 0) or 0
        label = f"(-) Reembolsos en Efectivo ({returns_count})" if returns_count else "(-) Reembolsos en Efectivo"
        recon_row(label, cash_refunds, text_color=red_color)

    pdf.set_draw_color(220, 220, 220)
    pdf.line(120, pdf.get_y(), 195, pdf.get_y())

    recon_row("(=) SALDO ESPERADO EN CAJA", expected['cash_physical'], is_bold=True)
    pdf.ln(2)
    
    pdf.set_fill_color(241, 245, 249)
    pdf.rect(10, pdf.get_y(), 190, 10, 'F')
    recon_row("MONTO REPORTADO (CONTADO)", recon['reported'], is_bold=True, text_color=accent_color)
    
    diff_color = red_color if recon['difference'] < -0.01 else green_color if recon['difference'] > 0.01 else (0,0,0)
    recon_row(f"DIFERENCIA ({'FALTANTE' if recon['difference'] < 0 else 'SOBRANTE' if recon['difference'] > 0 else 'EXACTA'})", recon['difference'], is_bold=True, text_color=diff_color)

    # --- MOVEMENTS DETAILS ---
    if movements['list']:
        pdf.ln(10)
        pdf.set_font("Arial", "B", 10)
        pdf.set_text_color(*primary_color)
        pdf.cell(0, 8, "HISTORIAL DE MOVIMIENTOS MANUALES", 0, 1)
        
        pdf.set_font("Arial", "B", 8)
        pdf.set_fill_color(241, 245, 249)
        pdf.cell(20, 6, " HORA", 0, 0, 'L', True)
        pdf.cell(25, 6, "TIPO", 0, 0, 'C', True)
        pdf.cell(110, 6, "MOTIVO / REFERENCIA", 0, 0, 'L', True)
        pdf.cell(35, 6, "MONTO ", 0, 1, 'R', True)
        
        pdf.set_font("Arial", "", 8)
        for m in movements['list']:
            pdf.cell(20, 6, m['time'], 'B', 0, 'L')
            label = "ENTRADA" if m['type'] == 'IN' else "SALIDA"
            pdf.cell(25, 6, label, 'B', 0, 'C')
            pdf.cell(110, 6, m['reason'][:60], 'B', 0, 'L')
            pdf.cell(35, 6, f"${m['amount']:,.2f} ", 'B', 1, 'R')

    # --- SIGNATURES ---
    pdf.set_y(-45)
    pdf.set_draw_color(180, 180, 180)
    
    pdf.set_x(20)
    pdf.line(20, pdf.get_y(), 85, pdf.get_y())
    pdf.line(125, pdf.get_y(), 190, pdf.get_y())
    
    pdf.set_font("Arial", "B", 8)
    pdf.set_text_color(100, 116, 139)
    pdf.set_x(20)
    pdf.cell(65, 5, "FIRMA CAJERO", 0, 0, 'C')
    pdf.set_x(125)
    pdf.cell(65, 5, "FIRMA SUPERVISOR", 0, 1, 'C')
    
    pdf.set_font("Arial", "", 8)
    pdf.set_x(20)
    pdf.cell(65, 5, session['user_name'].upper(), 0, 0, 'C')

    return bytes(pdf.output())
