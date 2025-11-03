// --- Variables Globales y Helpers de Persistencia ---
const DB_COLLECTION = "sistemas-lineales-2x2";
const APP_ID = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Contador para generar IDs únicos para cada ejercicio añadido al reporte
let ejercicioCounter = 0; 

// Obtiene la ruta de la colección de ejercicios del usuario actual
function getCollectionRef() {
    if (!window.db || !window.userId) {
        console.error("Firestore no está inicializado o el usuario no está autenticado.");
        return null; 
    }
    // Ruta privada: /artifacts/{appId}/users/{userId}/{collectionName}
    return collection(window.db, `artifacts/${APP_ID}/users/${window.userId}/${DB_COLLECTION}`);
}

// --- Funciones Auxiliares ---

// Función auxiliar para formatear la ecuación ax + by = c (MEJORADO PARA MANEJO DE SIGNOS)
function formatEq(a, b, c, varX = 'x', varY = 'y') {
    let eq = '';
    
    // Término X
    if (a !== 0) {
        if (a === 1) eq += varX;
        else if (a === -1) eq += `-${varX}`;
        else eq += `${a}${varX}`;
    }
    
    // Término Y
    if (b !== 0) {
        if (eq.length > 0) { // Si ya hay un término X
            if (b > 0) {
                eq += ' + ';
                if (b === 1) eq += varY;
                else eq += `${b}${varY}`;
            } else { // b < 0
                eq += ' ';
                if (b === -1) eq += `- ${varY}`;
                else eq += `${b}${varY}`;
            }
        } else { // Si es el primer término (a es 0)
            if (b === 1) eq += varY;
            else if (b === -1) eq += `-${varY}`;
            else eq += `${b}${varY}`;
        }
    }

    if (a === 0 && b === 0) return `0 = ${c}`;
    eq += ` = ${c}`;
    
    // Limpieza final de espacios dobles si se diera el caso, aunque la lógica está ajustada.
    return eq.trim(); 
}

// Función auxiliar para obtener el Máximo Común Divisor (MCD) 
function mcd(a, b) {
    return b ? mcd(b, a % b) : a;
}

// Función auxiliar para simplificar fracciones y devolver texto 
function simplify(numerator, denominator) {
    if (denominator === 0) return { num: numerator, den: 0, text: "INDETERMINADO" };
    if (numerator === 0) return { num: 0, den: 1, text: "0" };

    const common = mcd(Math.abs(numerator), Math.abs(denominator));
    
    let num_s = numerator / common;
    let den_s = denominator / common;
    
    if (den_s < 0) {
        num_s = -num_s;
        den_s = -den_s;
    }
    
    if (den_s === 1) {
        return { num: num_s, den: 1, text: `${num_s}` };
    }

    return { num: num_s, den: den_s, text: `${num_s}/${den_s}` };
}

// Helper para Despeje: y = m*x + n
function despejarY(a, b, c) {
    if (b === 0) return { m: NaN, n: NaN, formula: "No se puede despejar 'y'." };
    
    const m_num = -a;
    const m_den = b;
    const n_num = c;
    const n_den = b;
    
    const m_s = simplify(m_num, m_den).text;
    const n_s = simplify(n_num, n_den).text;
    
    let formula = "";
    const m_val = m_num / m_den;
    const n_val = n_num / n_den;

    if (m_num !== 0) {
        formula += `${m_s}x`;
    }
    if (n_num !== 0) {
        if (formula.length > 0) {
            formula += n_val > 0 ? ` + ${n_s}` : ` ${n_s}`; 
        } else {
            formula += n_s;
        }
    } else if (m_num === 0) {
        formula = "0";
    }

    // MODIFICACIÓN: Retorna los términos simplificados en texto (m_s y n_s) para Sustitución detallada
    return { m: m_val, n: n_val, m_s: m_s, n_s: n_s, formula: `y = ${formula.trim()}` };
}

// Helper para Tabulación (AJUSTADA para vista en vivo o reporte)
function getTabulation(a, b, c, eqNum, isLiveView = true) {
    const { m, n, formula } = despejarY(a, b, c);
    
    if (b === 0) return `<p>⚠️ No se puede tabular Ec. ${eqNum} porque la variable 'y' no existe o tiene coeficiente 0.</p>`;
    
    const format = (val) => Number.isInteger(val) ? val : parseFloat(val.toFixed(2));
    const points = [];
    
    // Función de sustitución detallada (se usa para generar el paso a paso)
    const getSubstitutionStep = (x_val, y_val_manual = null) => {
        let y_val = y_val_manual !== null ? y_val_manual : (m * x_val + n);
        const formatted_y = format(y_val);
        const formatted_m = format(m);
        const formatted_n = format(n);
        
        let m_term = m === 0 ? "" : `${formatted_m} * (${x_val})`;
        
        let step = `<p><b>Para x = ${x_val}:</b></p>`;
        step += `<p class="tab-step">y = ${formatted_m}x ${formatted_n >= 0 ? '+' : ''} ${formatted_n}</p>`;
        
        if (y_val_manual === null) {
            step += `<p class="tab-step">y = ${m_term} ${formatted_n >= 0 ? '+' : ''} ${formatted_n}</p>`;
            if (m !== 0) {
                step += `<p class="tab-step">y = ${format(m * x_val)} ${formatted_n >= 0 ? '+' : ''} ${formatted_n}</p>`;
            }
        } else {
            step += `<p class="tab-step">El valor de y=${formatted_y} fue ingresado manualmente.</p>`;
        }
        
        step += `<p class="tab-step-result">y = ${formatted_y} (Punto: (${x_val}, ${formatted_y}))</p>`;
        
        return { x: x_val, y: formatted_y, steps: step };
    };

    if (isLiveView) {
        // Lógica de VISTA EN VIVO (lee inputs manuales si existen)
        const x1_manual = parseFloat(document.getElementById(`x${eqNum}_p1`).value);
        const y1_manual = document.getElementById(`y${eqNum}_p1`).value.trim();
        const x2_manual = parseFloat(document.getElementById(`x${eqNum}_p2`).value);
        const y2_manual = document.getElementById(`y${eqNum}_p2`).value.trim();

        if (!isNaN(x1_manual) && (y1_manual !== "" && !isNaN(parseFloat(y1_manual)))) {
            points.push(getSubstitutionStep(x1_manual, parseFloat(y1_manual)));
        } else if (!isNaN(x1_manual) && y1_manual === "") {
            points.push(getSubstitutionStep(x1_manual));
        } else {
            points.push(getSubstitutionStep(0));
        }

        if (!isNaN(x2_manual) && (y2_manual !== "" && !isNaN(parseFloat(y2_manual)))) {
            points.push(getSubstitutionStep(x2_manual, parseFloat(y2_manual)));
        } else if (!isNaN(x2_manual) && y2_manual === "") {
            points.push(getSubstitutionStep(x2_manual));
        } else {
            points.push(getSubstitutionStep(1));
        }
    } else {
        // Lógica de REPORTE (Tabulación automática simple para asegurar reproducibilidad)
        points.push(getSubstitutionStep(0));
        points.push(getSubstitutionStep(1));
    }


    return `
        <div class="tabulation-wrapper">
            <p><b>Ecuación ${eqNum} despejada:</b> <code>${formula}</code></p>
            <div class="tabulation-content">
                <div class="tabulation-steps">
                    ${points[0].steps}
                </div>
                <div class="tabulation-steps">
                    ${points[1].steps}
                </div>
                <div class="tabulation-table">
                    <h4>Tabla de Tabulación</h4>
                    <table>
                        <thead><tr><th>x</th><th>y</th></tr></thead>
                        <tbody>
                            <tr><td>${points[0].x}</td><td>${points[0].y}</td></tr>
                            <tr><td>${points[1].x}</td><td>${points[1].y}</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

// --- Función para Dibujar Gráfica con Plotly (RANGO AJUSTADO Y PEQUEÑO) ---
function drawGraph(a1, b1, c1, a2, b2, c2, x_sol, y_sol, containerId) {
    if (!document.getElementById(containerId)) return;

    const { m: m1, n: n1 } = despejarY(a1, b1, c1);
    const { m: m2, n: n2 } = despejarY(a2, b2, c2);

    // 2. RANGO AJUSTADO para Ejes X y Y (PEQUEÑO)
    
    const padding = 3; // Margen alrededor del punto de solución
    const min_range = 8; // Mínimo de 8 unidades de ancho/alto total

    // a. Rango de X (centrado en la solución)
    let x_min = x_sol - padding;
    let x_max = x_sol + padding;
    if (x_max - x_min < min_range) {
        x_min = x_sol - min_range / 2;
        x_max = x_sol + min_range / 2;
    }
    
    // b. Calcular rango de Y (basado en las líneas en el rango de X)
    const x_range_plot = Array.from({ length: 100 }, (_, i) => x_min + i * (x_max - x_min) / 99);
    const y1_line = x_range_plot.map(x => m1 * x + n1);
    const y2_line = x_range_plot.map(x => m2 * x + n2);
    
    const y_min_data = Math.min(...y1_line, ...y2_line, y_sol);
    const y_max_data = Math.max(...y1_line, ...y2_line, y_sol);
    
    let y_min = y_min_data - padding;
    let y_max = y_max_data + padding;
    if (y_max - y_min < min_range) {
        const center_y = (y_min + y_max) / 2;
        y_min = center_y - min_range / 2;
        y_max = center_y + min_range / 2;
    }

    // 3. Crear las trazas
    const trace1 = {
        x: x_range_plot,
        y: y1_line,
        mode: 'lines',
        name: `Ec. 1: ${formatEq(a1, b1, c1)}`,
        line: { color: 'blue' }
    };

    const trace2 = {
        x: x_range_plot,
        y: y2_line,
        mode: 'lines',
        name: `Ec. 2: ${formatEq(a2, b2, c2)}`,
        line: { color: 'red' }
    };
    
    const solution_point = {
        x: [x_sol],
        y: [y_sol],
        mode: 'markers',
        type: 'scatter',
        name: `Solución: (${parseFloat(x_sol.toFixed(2))}, ${parseFloat(y_sol.toFixed(2))})`,
        marker: { size: 10, color: 'green', symbol: 'circle' }
    };

    const data = [trace1, trace2, solution_point];

    // 4. Configurar el layout
    const layout = {
        title: `Gráfico Ejercicio #${containerId.split('-').pop()}`,
        xaxis: { 
            title: 'Eje X', 
            zeroline: true, 
            zerolinewidth: 1, 
            range: [x_min, x_max],
            dtick: 1 // Fuerza las marcas cada 1 unidad
        },
        yaxis: { 
            title: 'Eje Y', 
            zeroline: true, 
            zerolinewidth: 1, 
            range: [y_min, y_max],
            dtick: 1 // Fuerza las marcas cada 1 unidad
        },
        hovermode: 'closest',
        autosize: true,
        height: 400,
        margin: { t: 50, b: 50, l: 50, r: 50 }
    };

    Plotly.newPlot(containerId, data, layout, {responsive: true});
}


/**
 * Genera el HTML del proceso de resolución y devuelve la solución. 
 * Acepta el ID del contenedor de la gráfica para incrustarlo y si es la vista en vivo.
 */
function _generateProccessHTML(a1, b1, c1, a2, b2, c2, metodo, containerId, isLiveView) {
    // CORRECCIÓN DEL PUNTO DE INTERSECCIÓN (Regla de Cramer)
    const D = a1 * b2 - a2 * b1;
    const Dx = c1 * b2 - c2 * b1;
    const Dy = a1 * c2 - a2 * c1; 
    
    let procesoHTML = `<h3>Sistema a Resolver:</h3>
        <p>Ec. 1: ${formatEq(a1, b1, c1)}</p>
        <p>Ec. 2: ${formatEq(a2, b2, c2)}</p>
        <hr>`;

    if (D === 0) {
        if (Dx === 0 && Dy === 0) {
            procesoHTML += '<p class="final-result">⚠️ El sistema tiene <b>infinitas soluciones</b> (ecuaciones dependientes o equivalentes).</p>';
        } else {
            procesoHTML += '<p class="final-result">⚠️ El sistema <b>no tiene solución</b> (inconsistente/paralelo).</p>';
        }
        return { x_val: NaN, y_val: NaN, procesoHTML: procesoHTML };
    }
    
    const x_val = Dx / D;
    const y_val = Dy / D;
    
    const x_result = simplify(Dx, D);
    const y_result = simplify(Dy, D);
    
    if (metodo === 'graficacion') {
        procesoHTML += '<h3>MÉTODO GRÁFICO:</h3>';
        procesoHTML += `
            <p><b>Paso 1: Despejar 'y' en ambas ecuaciones para obtener la forma pendiente-intersección (y = mx + n).</b></p>
            <p>Ec. 1: <code>${despejarY(a1, b1, c1).formula}</code></p>
            <p>Ec. 2: <code>${despejarY(a2, b2, c2).formula}</code></p>
            <p><b>Paso 2: Tabulación.</b></p>
            <div class="tabulacion-section">
                ${getTabulation(a1, b1, c1, 1, isLiveView)}
                ${getTabulation(a2, b2, c2, 2, isLiveView)}
            </div>
            <p><b>Paso 3: Cálculo Algebraico (Para verificación del punto de intersección).</b></p>
            <p>Usando la Regla de Cramer (Determinantes), se encuentra el punto exacto:</p>
            <p>D = ${D}, Dx = ${Dx}, Dy = ${Dy}</p>
            <p class="final-result">x = Dx / D = ${x_result.text}</p>
            <p class="final-result">y = Dy / D = ${y_result.text}</p>
            <p><b>Paso 4: Graficación.</b></p>
            <p>Punto de Intersección (Calculado): (${x_result.text}, ${y_result.text})</p>
            <div class="graph-wrapper">
                <div id="${containerId}" class="ejercicio-graph-container" style="height: 400px; width: 100%;"></div>
            </div>
        `;
    } 
    // Lógica para otros métodos (igualacion, sustitucion, eliminacion, determinantes)
    else if (metodo === 'igualacion') {
        procesoHTML += '<h3>MÉTODO DE IGUALACIÓN:</h3>';
        procesoHTML += `
            <p><b>Paso 1: Despejar 'y' (o 'x') en ambas ecuaciones.</b></p>
            <p>Ec. 1 \u2192 y = (${c1} - ${a1}x) / ${b1}</p>
            <p>Ec. 2 \u2192 y = (${c2} - ${a2}x) / ${b2}</p>
            <p><b>Paso 2: Igualar las expresiones y resolver para 'x'.</b></p>
            <p>(${c1} - ${a1}x) / ${b1} = (${c2} - ${a2}x) / ${b2}</p>
            <p>${b2}*(${c1} - ${a1}x) = ${b1}*(${c2} - ${a2}x)</p>
            <p>(${b2 * c1} - ${b2 * a1}x) = (${b1 * c2} - ${b1 * a2}x)</p>
            <p>(${b1 * a2 - b2 * a1})x = (${b1 * c2 - b2 * c1})</p>
            <p class="final-result">x = ${x_result.text}</p>
            <p><b>Paso 3: Sustituir el valor de 'x' en cualquiera de las ecuaciones despejadas y resolver para 'y'.</b></p>
            <p>y = (${c1} - ${a1}*(${x_result.text})) / ${b1}</p>
            <p class="final-result">y = ${y_result.text}</p>
        `;
    } else if (metodo === 'sustitucion') {
        // Despejar la variable más simple (por simplicidad, despejamos y de Ec. 1)
        // Se requiere que despejarY retorne m_s y n_s (texto simplificado de la pendiente y ordenada)
        const { m, n, m_s, n_s, formula: despeje_formula } = despejarY(a1, b1, c1); 
        
        // Coeficientes y constantes de la ecuación lineal después de la sustitución y distributiva.
        
        // 1. Cálculo de términos para el desglose (b2*m y b2*n)
        // b2*m = b2*(-a1/b1)
        const term_m_num = b2 * (-a1);
        const term_m_den = b1;
        const term_m_s = simplify(term_m_num, term_m_den).text;

        // b2*n = b2*(c1/b1)
        const term_n_num = b2 * c1;
        const term_n_den = b1;
        const term_n_s = simplify(term_n_num, term_n_den).text;
        
        // 2. Coeficiente final de x (a2 + b2*m) y Constante final (c2 - b2*n)
        const coef_x_num = a2 * b1 + term_m_num; // a2*b1 + b2*(-a1)
        const coef_x_den = b1;
        const coef_x_s = simplify(coef_x_num, coef_x_den).text;
        
        const const_num = c2 * b1 - term_n_num; // c2*b1 - b2*c1
        const const_den = b1;
        const const_s = simplify(const_num, const_den).text;

        procesoHTML += '<h3>MÉTODO DE SUSTITUCIÓN:</h3>';
        
        // PASO 1
        procesoHTML += `
            <p><b>Paso 1: Despejar una variable en una de las ecuaciones.</b></p>
            <p class="detalle-paso">Despejamos 'y' de la Ec. 1 (${formatEq(a1, b1, c1)}) para obtener una expresión para 'y':</p>
            <p class="formula-paso">Ec. 1 Modificada \u2192 <code>${despeje_formula}</code></p>
        `;
        
        // PASO 2
        const x_term_distrib = `${term_m_s}x`;
        const const_term_distrib = `${term_n_s}`;
        
        procesoHTML += `
            <p><b>Paso 2: Sustituir la expresión en la otra ecuación (Ec. 2) y resolver para 'x'.</b></p>
            <p class="detalle-paso">Sustituimos la expresión de 'y' en la Ec. 2 (${formatEq(a2, b2, c2)}):</p>
            <p class="formula-paso">${formatEq(a2, 0, 0)} + ${b2}*(${despeje_formula.substring(4).trim()}) = ${c2}</p>
            
            <p class="detalle-paso">Aplicamos la propiedad distributiva (${b2} se multiplica por cada término):</p>
            <p class="formula-paso">${formatEq(a2, 0, 0)} ${x_term_distrib.startsWith('-') ? '' : '+'} ${x_term_distrib} ${const_term_distrib.startsWith('-') ? '' : '+'} ${const_term_distrib} = ${c2}</p>
            
            <p class="detalle-paso">Agrupamos términos con 'x' a un lado y constantes al otro:</p>
            <p class="formula-paso">(${a2} ${term_m_s.startsWith('-') ? '' : '+'} ${term_m_s})x = ${c2} ${term_n_s.startsWith('-') ? '+' : '-'} ${simplify(-term_n_num, term_n_den).text}</p>
            <p class="formula-paso">${coef_x_s}x = ${const_s}</p>
            
            <p class="detalle-paso">Despejamos 'x':</p>
            <p class="final-result">x = ${x_result.text}</p>
        `;
        
        // PASO 3
        const x_to_substitute = x_result.text.includes('/') ? `(${x_result.text})` : x_result.text;
        
        procesoHTML += `
            <p><b>Paso 3: Sustituir el valor de 'x' en el despeje del Paso 1 para encontrar 'y'.</b></p>
            <p class="detalle-paso">Usamos el despeje: <code>${despeje_formula}</code></p>
            <p class="formula-paso">y = ${m_s}*${x_to_substitute} ${n_s.startsWith('-') ? '' : '+'} ${n_s}</p>
            <p class="detalle-paso">Realizamos la operación y simplificamos:</p>
            <p class="final-result">y = ${y_result.text}</p>
        `;
    } else if (metodo === 'eliminacion') {
        // --- Cálculo para Eliminar 'y' (Encontrar X) ---
        const M1_x = b2;
        const M2_x = -b1;
        
        const A_x = a1 * M1_x + a2 * M2_x; // Coef. final de x
        const C_x = c1 * M1_x + c2 * M2_x; // Constante final
        
        // Coeficientes resultantes después de la multiplicación
        const a1_new_x = a1 * M1_x;
        const b1_new_x = b1 * M1_x; 
        const c1_new_x = c1 * M1_x;
        
        const a2_new_x = a2 * M2_x;
        const b2_new_x = b2 * M2_x; 
        const c2_new_x = c2 * M2_x;

        // Simplificamos los resultados finales (aunque sean enteros, para limpieza)
        const coef_x_s = simplify(A_x, 1).text;
        const const_x_s = simplify(C_x, 1).text;
        
        // --- Cálculo para Eliminar 'x' (Encontrar Y) ---
        const M1_y = a2;
        const M2_y = -a1;
        
        const B_y = b1 * M1_y + b2 * M2_y; // Coef. final de y
        const C_y = c1 * M1_y + c2 * M2_y; // Constante final
        
        // Coeficientes resultantes después de la multiplicación
        const a1_new_y = a1 * M1_y;
        const b1_new_y = b1 * M1_y;
        const c1_new_y = c1 * M1_y;
        
        const a2_new_y = a2 * M2_y;
        const b2_new_y = b2 * M2_y;
        const c2_new_y = c2 * M2_y;

        // Simplificamos los resultados finales (aunque sean enteros, para limpieza)
        const coef_y_s = simplify(B_y, 1).text;
        const const_y_s = simplify(C_y, 1).text;
        
        procesoHTML += '<h3>MÉTODO DE ELIMINACIÓN (REDUCCIÓN):</h3>';

        // PASO 1 (Eliminar Y para encontrar X)
        procesoHTML += `
            <p><b>Paso 1: Eliminar 'y' para encontrar 'x'.</b></p>
            <p class="detalle-paso">Multiplicamos Ec. 1 por ${M1_x} y Ec. 2 por ${M2_x}:</p>
            <p class="formula-paso">Ec. 1 * ${M1_x} \u2192 <code>${formatEq(a1_new_x, b1_new_x, c1_new_x)}</code></p>
            <p class="formula-paso">Ec. 2 * ${M2_x} \u2192 <code>${formatEq(a2_new_x, b2_new_x, c2_new_x)}</code></p>
            
            <p class="detalle-paso">Sumamos las ecuaciones. 'y' se cancela:</p>
            <p class="formula-paso">${coef_x_s}x = ${const_x_s}</p>
            
            <p class="detalle-paso">Despejamos 'x':</p>
            <p class="final-result">x = ${x_result.text}</p>
        `;
        
        // PASO 2 (Eliminar X para encontrar Y)
        procesoHTML += `
            <p><b>Paso 2: Eliminar 'x' para encontrar 'y'.</b></p>
            <p class="detalle-paso">Multiplicamos Ec. 1 por ${M1_y} y Ec. 2 por ${M2_y}:</p>
            <p class="formula-paso">Ec. 1 * ${M1_y} \u2192 <code>${formatEq(a1_new_y, b1_new_y, c1_new_y)}</code></p>
            <p class="formula-paso">Ec. 2 * ${M2_y} \u2192 <code>${formatEq(a2_new_y, b2_new_y, c2_new_y)}</code></p>
            
            <p class="detalle-paso">Sumamos las ecuaciones. 'x' se cancela:</p>
            <p class="formula-paso">${coef_y_s}y = ${const_y_s}</p>
            
            <p class="detalle-paso">Despejamos 'y':</p>
            <p class="final-result">y = ${y_result.text}</p>
        `;
    } else if (metodo === 'determinantes') {
        procesoHTML += '<h3>MÉTODO DE DETERMINANTES (REGLA DE CRAMER):</h3>';
        procesoHTML += `
            <p><b>Paso 1: Calcular el Determinante del Sistema (D).</b></p>
            <p>D = (${a1} * ${b2}) - (${b1} * ${a2}) = ${D}</p>
            <p><b>Paso 2: Calcular el Determinante de X (Dx).</b></p>
            <p>Dx = (${c1} * ${b2}) - (${b1} * ${c2}) = ${Dx}</p>
            <p><b>Paso 3: Calcular el Determinante de Y (Dy).</b></p>
            <p>Dy = (${a1} * ${c2}) - (${c1} * ${a2}) = ${Dy}</p>
            <p><b>Paso 4: Hallar las soluciones ('x' e 'y').</b></p>
            <p>x = Dx / D = ${Dx} / ${D}</p>
            <p class="final-result">x = ${x_result.text}</p>
            <p>y = Dy / D = ${Dy} / ${D}</p>
            <p class="final-result">y = ${y_result.text}</p>
        `;
    }

    procesoHTML += `<p><b>Solución Final:</b> x = ${x_result.text}, y = ${y_result.text}</p>`;

    return { x_val, y_val, procesoHTML };
}

// --- Funciones de Control de la Interfaz ---

/**
 * Resuelve el sistema actual, genera el proceso y lo muestra en la vista en vivo.
 */
window.resolverEnVivo = function() {
    const a1 = parseFloat(document.getElementById('a1').value);
    const b1 = parseFloat(document.getElementById('b1').value);
    const c1 = parseFloat(document.getElementById('c1').value);
    const a2 = parseFloat(document.getElementById('a2').value);
    const b2 = parseFloat(document.getElementById('b2').value);
    const c2 = parseFloat(document.getElementById('c2').value);
    const metodo = document.getElementById('metodo').value;
    const liveGraphId = 'graph-container';
    const graphWrapper = document.getElementById('graph-wrapper');

    if ([a1, b1, c1, a2, b2, c2].some(isNaN)) {
        document.getElementById('proceso').innerHTML = '<p class="error-msg">❌ ERROR: Por favor, ingrese valores numéricos válidos en todos los campos.</p>';
        return;
    }

    // 1. Generar el proceso para la VISTA EN VIVO (isLiveView=true para leer inputs manuales)
    const { x_val, y_val, procesoHTML } = _generateProccessHTML(a1, b1, c1, a2, b2, c2, metodo, liveGraphId, true);

    // 2. Mostrar el resultado
    document.getElementById('proceso').innerHTML = procesoHTML;
    document.getElementById('output-title').textContent = `✨ Solución y Proceso (Último Cálculo con ${document.getElementById('metodo').options[document.getElementById('metodo').selectedIndex].text}) ✨`;

    // 3. Dibujar/Ocultar la gráfica de la VISTA EN VIVO (Corrección del espacio en blanco)
    if (metodo === 'graficacion' && !isNaN(x_val)) {
        if(graphWrapper) graphWrapper.style.display = 'block';
        drawGraph(a1, b1, c1, a2, b2, c2, x_val, y_val, liveGraphId);
    } else {
        Plotly.purge(liveGraphId); // Limpiar la gráfica
        if(graphWrapper) graphWrapper.style.display = 'none'; // OCULTAR EL ESPACIO
    }
}

/**
 * Resuelve el sistema actual, genera el proceso y lo añade al reporte final.
 */
window.agregarEjercicioAlReporte = function() {
    const a1 = parseFloat(document.getElementById('a1').value);
    const b1 = parseFloat(document.getElementById('b1').value);
    const c1 = parseFloat(document.getElementById('c1').value);
    const a2 = parseFloat(document.getElementById('a2').value);
    const b2 = parseFloat(document.getElementById('b2').value);
    const c2 = parseFloat(document.getElementById('c2').value);
    const metodo = document.getElementById('metodo').value;
    const liveGraphId = 'graph-container';
    const graphWrapper = document.getElementById('graph-wrapper');

    if ([a1, b1, c1, a2, b2, c2].some(isNaN)) {
        document.getElementById('proceso').innerHTML = '<p class="error-msg">❌ ERROR: Por favor, ingrese valores numéricos válidos en todos los campos.</p>';
        return;
    }

    // 1. Resolver en vivo primero para mostrar el resultado al usuario
    const { x_val, y_val, procesoHTML: liveHTML } = _generateProccessHTML(a1, b1, c1, a2, b2, c2, metodo, liveGraphId, true);
    
    // 2. Generar un ID único para el contenedor de la gráfica del reporte
    ejercicioCounter++; 
    const reportGraphId = `report-graph-${ejercicioCounter}`;
    const reportItemId = `report-item-${ejercicioCounter}`; // ID único para el item del reporte

    // 3. Generar el proceso para el REPORTE (isLiveView=false para tabulación automática)
    const { procesoHTML: reportHTML } = _generateProccessHTML(a1, b1, c1, a2, b2, c2, metodo, reportGraphId, false);

    // 4. Actualizar la VISTA EN VIVO
    document.getElementById('proceso').innerHTML = liveHTML;
    document.getElementById('output-title').textContent = `✨ Solución y Proceso (Último Cálculo con ${document.getElementById('metodo').options[document.getElementById('metodo').selectedIndex].text}) ✨`;

    // 5. Dibujar/Ocultar la gráfica de la VISTA EN VIVO (Corrección del espacio en blanco)
    if (metodo === 'graficacion' && !isNaN(x_val)) {
        if(graphWrapper) graphWrapper.style.display = 'block';
        drawGraph(a1, b1, c1, a2, b2, c2, x_val, y_val, liveGraphId);
    } else {
        Plotly.purge(liveGraphId); // Limpiar la gráfica
        if(graphWrapper) graphWrapper.style.display = 'none'; // OCULTAR EL ESPACIO
    }

    // 6. Añadir al REPORTE (Añadido botón de eliminar)
    const reportItem = document.createElement('div');
    reportItem.id = reportItemId; // ID único para el item del reporte
    reportItem.className = 'ejercicio-reporte-item';
    reportItem.innerHTML = `
        <div class="report-header-flex">
            <h3 class="report-title">Ejercicio #${ejercicioCounter}: ${document.getElementById('metodo').options[document.getElementById('metodo').selectedIndex].text}</h3>
            <button onclick="eliminarEjercicioDelReporte('${reportItemId}')" class="delete-report-item-btn" title="Eliminar del Reporte">❌</button>
        </div>
        <p class="report-system">Sistema: ${formatEq(a1, b1, c1)}, ${formatEq(a2, b2, c2)}</p>
        <div class="report-process">${reportHTML}</div>
    `;
    document.getElementById('reporte-ejercicios-list').appendChild(reportItem);

    // 7. Dibujar la gráfica del REPORTE (si aplica)
    if (metodo === 'graficacion' && !isNaN(x_val)) {
        // La gráfica se dibuja con un pequeño retraso para asegurar que el DOM esté listo
        // Se dibuja en el contenedor que está dentro de reportHTML.
        setTimeout(() => {
            drawGraph(a1, b1, c1, a2, b2, c2, x_val, y_val, reportGraphId);
        }, 50); 
    }
}

/**
 * Elimina un ejercicio del Reporte local (función de mejora solicitada).
 * @param {string} id El ID del elemento div del reporte a eliminar.
 */
window.eliminarEjercicioDelReporte = function(id) {
    const item = document.getElementById(id);
    if (item) {
        // Encontrar el contenedor de la gráfica y purgar Plotly antes de la eliminación
        const graphContainer = item.querySelector('.ejercicio-graph-container');
        if (graphContainer && graphContainer.id) {
            Plotly.purge(graphContainer.id);
        }
        item.remove();
        document.getElementById('proceso').innerHTML = '<p class="final-result">🗑️ Ejercicio eliminado del reporte local.</p>';
    }
}

/**
 * Limpia la sección del reporte.
 */
window.limpiarReporte = function() {
    if (confirm("¿Estás seguro de que quieres limpiar el reporte? Esta acción es irreversible.")) {
        const reporteList = document.getElementById('reporte-ejercicios-list');
        // Purge all Plotly graphs inside the report before clearing the DOM
        const graphContainers = reporteList.querySelectorAll('.ejercicio-graph-container');
        graphContainers.forEach(container => Plotly.purge(container.id));
        
        reporteList.innerHTML = '';
        ejercicioCounter = 0; // Reiniciar el contador
        document.getElementById('proceso').innerHTML = '<p>Ingrese los coeficientes del sistema 2x2 y seleccione un método para ver el proceso de resolución y el resultado aquí.</p>';
        document.getElementById('output-title').textContent = 'Resultado y Proceso';
        const liveGraphId = 'graph-container';
        Plotly.purge(liveGraphId);
        const graphWrapper = document.getElementById('graph-wrapper');
        if(graphWrapper) graphWrapper.style.display = 'none';
    }
}

/**
 * Guarda el ejercicio resuelto en Firestore.
 */
window.guardarEjercicio = async function() {
    const a1 = parseFloat(document.getElementById('a1').value);
    const b1 = parseFloat(document.getElementById('b1').value);
    const c1 = parseFloat(document.getElementById('c1').value);
    const a2 = parseFloat(document.getElementById('a2').value);
    const b2 = parseFloat(document.getElementById('b2').value);
    const c2 = parseFloat(document.getElementById('c2').value);
    const metodo = document.getElementById('metodo').value;

    if ([a1, b1, c1, a2, b2, c2].some(isNaN)) {
        document.getElementById('proceso').innerHTML = '<p class="error-msg">❌ ERROR: Por favor, ingrese valores numéricos válidos en todos los campos.</p>';
        return;
    }
    
    // CORRECCIÓN DEL PUNTO DE INTERSECCIÓN (Regla de Cramer)
    const D = a1 * b2 - a2 * b1;
    if (D === 0) {
         document.getElementById('proceso').innerHTML = '<p class="error-msg">❌ ERROR: El sistema es inconsistente o dependiente y no se puede guardar como un sistema con solución única.</p>';
         return;
    }
    
    const Dx = c1 * b2 - c2 * b1;
    const Dy = a1 * c2 - a2 * c1; 
    const x_result = simplify(Dx, D).text;
    const y_result = simplify(Dy, D).text;
    
    // Usamos un ID temporal para la gráfica del proceso que se guarda.
    const tempGraphId = 'temp-save-graph'; 
    const { procesoHTML } = _generateProccessHTML(a1, b1, c1, a2, b2, c2, metodo, tempGraphId, false);
    
    const ejercicioData = {
        ecuacion1: formatEq(a1, b1, c1),
        ecuacion2: formatEq(a2, b2, c2),
        a1, b1, c1, a2, b2, c2,
        metodo,
        solucion_x: x_result,
        solucion_y: y_result,
        fecha: new Date().toISOString(),
        // Reemplazamos el ID temporal para que no cause problemas al cargarse
        proceso_html: procesoHTML.replace(`id="${tempGraphId}"`, 'id=""'), 
        nombre: document.getElementById('integrantes').value || "Ejercicio Sin Nombre",
        metodo_label: document.getElementById('metodo').options[document.getElementById('metodo').selectedIndex].text
    };

    try {
        const docRef = await addDoc(getCollectionRef(), ejercicioData);
        document.getElementById('proceso').innerHTML = `<p class="final-result">✅ Ejercicio guardado exitosamente (ID: ${docRef.id}): x=${ejercicioData.solucion_x}, y=${ejercicioData.solucion_y}</p>`;
    } catch (e) {
        console.error("Error al guardar el documento: ", e);
        document.getElementById('proceso').innerHTML = `<p class="error-msg">❌ Error al guardar: ${e.message}</p>`;
    }
}

/**
 * Carga un ejercicio guardado, lo pone en los inputs y lo añade al reporte.
 * @param {string} id El ID del documento de Firestore a cargar.
 */
window.cargarEjercicioAlInput = async function(id) {
    const colRef = getCollectionRef();
    if (!colRef) return;
    
    try {
        // En un entorno de producción, se usaría un `getDoc` para obtener uno solo. 
        // Usamos getDocs y where para una emulación más simple aquí:
        const q = query(colRef, where(firebase.firestore.FieldPath.documentId(), '==', id));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            alert("Ejercicio no encontrado.");
            return;
        }
        
        const data = snapshot.docs[0].data();

        // 1. Cargar datos a los inputs
        document.getElementById('a1').value = data.a1;
        document.getElementById('b1').value = data.b1;
        document.getElementById('c1').value = data.c1;
        document.getElementById('a2').value = data.a2;
        document.getElementById('b2').value = data.b2;
        document.getElementById('c2').value = data.c2;
        document.getElementById('metodo').value = data.metodo;
        
        // 2. Resolver y Añadir al Reporte (para mostrar el proceso completo y la gráfica)
        // Esto también actualiza la vista en vivo
        agregarEjercicioAlReporte();

    } catch (e) {
        console.error("Error al cargar el ejercicio:", e);
        alert(`Error al cargar el ejercicio: ${e.message}`);
    }
}

/**
 * Muestra el proceso (HTML) de un ejercicio guardado en un modal.
 * @param {string} id El ID del documento de Firestore.
 */
window.mostrarProcesoGuardado = async function(id) {
    const colRef = getCollectionRef();
    if (!colRef) return;
    
    const liveGraphId = 'graph-container-modal'; // ID del contenedor de la gráfica DENTRO del modal
    const modalContentDiv = document.getElementById('proceso-guardado-content');
    const modal = document.getElementById('proceso-guardado-modal');
    
    try {
        // En un entorno de producción, se usaría un `getDoc` para obtener uno solo. 
        // Usamos getDocs y where para una emulación más simple aquí:
        const q = query(colRef, where(firebase.firestore.FieldPath.documentId(), '==', id));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            modalContentDiv.innerHTML = '<p class="error-msg">Ejercicio no encontrado.</p>';
            modal.style.display = 'block';
            return;
        }
        
        const data = snapshot.docs[0].data();

        // 1. Reemplazar el proceso HTML y poner el ID real para Plotly
        let finalHTML = data.proceso_html.replace('id=""', `id="${liveGraphId}"`);
        
        // 2. Añadir el título y el contenido
        modalContentDiv.innerHTML = `<h3>Proceso Detallado: ${data.nombre} (${data.metodo_label})</h3>
                                    <p>Sistema: ${data.ecuacion1}, ${data.ecuacion2}</p>
                                    <p class="final-result">Solución: x=${data.solucion_x}, y=${data.solucion_y}</p>
                                    <hr>
                                    ${finalHTML}`;
        
        modal.style.display = 'block';
        
        const a1 = data.a1;
        const b1 = data.b1;
        const c1 = data.c1;
        const a2 = data.a2;
        const b2 = data.b2;
        const c2 = data.c2;

        const D = a1 * b2 - a2 * b1;
        const Dx = c1 * b2 - c2 * b1;
        const Dy = a1 * c2 - a2 * c1; 
        const x_val = D !== 0 ? Dx / D : NaN;
        const y_val = D !== 0 ? Dy / D : NaN;
        
        // 3. Dibujar la gráfica si el método original era Gráfico
        if (data.metodo === 'graficacion' && !isNaN(x_val)) { 
            setTimeout(() => {
                drawGraph(a1, b1, c1, a2, b2, c2, x_val, y_val, liveGraphId);
            }, 100); 
        } else {
            // Asegurarse de purgar por si había algo antes
            Plotly.purge(liveGraphId);
        }

    } catch (e) {
        console.error("Error al mostrar el proceso:", e);
        modalContentDiv.innerHTML = `<p class="error-msg">❌ Error al cargar el proceso: ${e.message}</p>`;
        modal.style.display = 'block';
    }
}

/**
 * Cierra el modal de proceso guardado.
 */
window.cerrarModal = function() {
    const modal = document.getElementById('proceso-guardado-modal');
    modal.style.display = 'none';
    const liveGraphId = 'graph-container-modal';
    Plotly.purge(liveGraphId); // Limpiar la gráfica al cerrar
}

/**
 * Carga todos los ejercicios guardados del usuario en la lista.
 */
window.cargarEjercicios = function() {
    const colRef = getCollectionRef();
    if (!colRef) return;

    const listDiv = document.getElementById('ejercicios-list');

    // Usamos onSnapshot para mantener la lista en tiempo real
    onSnapshot(colRef, (snapshot) => {
        listDiv.innerHTML = '';
        if (snapshot.empty) {
            listDiv.innerHTML = '<p>Aún no has guardado ningún ejercicio. ¡Resuelve y guarda uno!</p>';
            return;
        }
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const ejercicioId = doc.id;
            const item = document.createElement('div');
            item.className = 'ejercicio-item';
            item.innerHTML = `
                <div class="ejercicio-info">
                    <p class="ejercicio-title">${data.nombre} (${data.metodo_label})</p>
                    <p class="ejercicio-eq">${data.ecuacion1}, ${data.ecuacion2}</p>
                    <p class="ejercicio-sol">Solución: x=${data.solucion_x}, y=${data.solucion_y}</p>
                </div>
                <div class="ejercicio-actions">
                    <button onclick="cargarEjercicioAlInput('${ejercicioId}')" title="Cargar y Añadir al Reporte">➕</button>
                    <button onclick="mostrarProcesoGuardado('${ejercicioId}')" title="Ver Proceso">👁️</button>
                    <button onclick="eliminarEjercicio('${ejercicioId}')" title="Eliminar">🗑️</button>
                </div>
            `;
            listDiv.appendChild(item);
        });
    }, (error) => {
        console.error("Error al cargar ejercicios en tiempo real:", error);
        listDiv.innerHTML = `<p class="error-msg">Error al cargar ejercicios: ${error.message}</p>`;
    });
}

/**
 * Elimina un ejercicio guardado de Firestore.
 * @param {string} id El ID del documento de Firestore a eliminar.
 */
window.eliminarEjercicio = async function(id) {
    const colRef = getCollectionRef();
    if (!colRef) return;
    
    if (!confirm("¿Estás seguro de que quieres eliminar este ejercicio guardado en la nube?")) return;

    try {
        await deleteDoc(doc(colRef, id));
        document.getElementById('proceso').innerHTML = '<p class="final-result">🗑️ Ejercicio guardado eliminado exitosamente.</p>';
    } catch (e) {
        console.error("Error al eliminar el documento: ", e);
        document.getElementById('proceso').innerHTML = `<p class="error-msg">❌ Error al eliminar: ${e.message}</p>`;
    }
}


/**
 * Abre el sistema actual en la herramienta externa GeoGebra.
 */
window.abrirEnGeoGebra = function() {
    const a1 = parseFloat(document.getElementById('a1').value);
    const b1 = parseFloat(document.getElementById('b1').value);
    const c1 = parseFloat(document.getElementById('c1').value);
    const a2 = parseFloat(document.getElementById('a2').value);
    const b2 = parseFloat(document.getElementById('b2').value);
    const c2 = parseFloat(document.getElementById('c2').value);

    if ([a1, b1, c1, a2, b2, c2].some(isNaN)) {
        alert("Por favor, ingrese valores numéricos válidos en todos los campos para usar GeoGebra.");
        return;
    }

    const eq1 = `${formatEq(a1, b1, c1)}`;
    const eq2 = `${formatEq(a2, b2, c2)}`;
    
    // GeoGebra Graphing Calculator URL
    // Ejemplo: https://www.geogebra.org/graphing?evaluate=2x+y=8&evaluate=3x-y=7
    const geogebraURL = `https://www.geogebra.org/graphing?evaluate=${encodeURIComponent(eq1)}&evaluate=${encodeURIComponent(eq2)}`;

    window.open(geogebraURL, '_blank');
}

// Función de Exportación a PDF (usa la función nativa de impresión, el CSS maneja el formato)
window.exportarAPDF = function() {
    window.print();
}

// Inicializar la aplicación al cargar (Ocultar la gráfica al inicio y manejar la visibilidad de la tabulación manual)
window.onload = function() {
    // Referencias
    const metodoSelect = document.getElementById('metodo');
    const tabManualSection = document.getElementById('tabulacion-manual-section');
    const graphWrapper = document.getElementById('graph-wrapper');


    // Función para manejar la visibilidad de la sección de tabulación manual
    const handleMetodoChange = function() {
        if (metodoSelect.value === 'graficacion') {
            tabManualSection.style.display = 'block';
        } else {
            tabManualSection.style.display = 'none';
        }
    };

    // 1. Manejar la visibilidad inicial
    handleMetodoChange(); 
    if (graphWrapper) graphWrapper.style.display = 'none'; // OCULTAR ESPACIO AL INICIO

    // 2. Añadir el evento de cambio
    metodoSelect.onchange = handleMetodoChange;
    
    // 3. Inicializar el modal (si se hace click fuera, se cierra)
    const modal = document.getElementById('proceso-guardado-modal');
    window.onclick = function(event) {
        if (event.target === modal) {
            cerrarModal();
        }
    }
}
