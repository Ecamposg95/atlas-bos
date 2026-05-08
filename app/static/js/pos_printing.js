(function(window) {
    'use strict';

    /**
     * handlePrinting — sends a sale ticket to the local print agent.
     * Falls back with error alerts if agent is unreachable.
     *
     * @param {number|string} saleId - The sale ID to print.
     * @param {HTMLElement} btn - The button that triggered the action (used for state feedback).
     */
    async function handlePrinting(saleId, btn) {
        const prev = btn.innerHTML;
        btn.innerHTML = '<span class="animate-pulse">Imprimiendo...</span>';
        btn.disabled = true;

        try {
            // 1. Get Ticket Bytes (Server Side)
            const res = await SalesApi.fetch('/api/printer/print-ticket', {
                method: 'POST',
                body: JSON.stringify({ order_id: saleId, mode: 'return_base64' })
            });

            // 2. Send to Local Agent
            if (res.content_base64) {
                const targetPrinter = res.printer_target;
                if (!targetPrinter) {
                    window.showAlert("Error Configuración", "No hay impresora configurada en el sistema. Vaya a Configuración > Impresora.", "warning");
                    btn.innerHTML = 'Error Config';
                    return;
                }

                const agentUrl = window.PRINT_AGENT_URL || "https://localhost:9100/print";
                try {
                    const agentRes = await fetch(agentUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            content_base64: res.content_base64,
                            printer_name: targetPrinter
                        })
                    });

                    if (!agentRes.ok) throw new Error(`Agent returned ${agentRes.status}`);

                    await agentRes.json();

                    window.showAlert("Éxito", "Enviado a impresora", "success");
                    btn.innerHTML = '¡Enviado!';

                } catch (fetchErr) {
                    console.error("Agent Fetch Error:", fetchErr);
                    // Detect connection/cert errors
                    window.showAlert(
                        "Error de Conexión",
                        `No se pudo conectar con el Agente de Impresión.\n\n1. Verifique que el Agente esté corriendo.\n2. Si es la primera vez, visite https://localhost:9100/health y acepte el certificado.`,
                        "error"
                    );
                    throw fetchErr; // Re-throw to skip success state
                }
            } else {
                window.showAlert("Error", "El servidor no devolvió datos de impresión.", "error");
            }

        } catch (e) {
            console.error("Print Flow Error:", e);
            if (!e.message.includes("Agent")) {
                window.showAlert("Error", "Error al generar ticket: " + e.message, "error");
            }
            btn.innerHTML = 'Reintentar';
        } finally {
            setTimeout(() => {
                btn.disabled = false;
                if (btn.innerHTML === '¡Enviado!') {
                    setTimeout(() => btn.innerHTML = prev, 2000);
                } else if (btn.innerHTML === 'Reintentar') {
                    // Leave it as retry
                } else {
                    btn.innerHTML = prev;
                }
            }, 1000);
        }
    }

    // Expose on window so inline HTML handlers and DOMContentLoaded wiring can call it
    window.handlePrinting = handlePrinting;

})(window);
