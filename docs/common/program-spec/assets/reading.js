document.querySelector('#print')?.addEventListener('click', () => window.print());
document.querySelector('#menu-toggle')?.addEventListener('click', event => {
    const open = document.body.classList.toggle('menu-open');
    event.currentTarget.setAttribute('aria-expanded', String(open));
});
const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd');
document.querySelector('#toc-search')?.addEventListener('input', event => {
    const query = normalize(event.target.value);
    let count = 0;
    document.querySelectorAll('nav .links a').forEach(link => {
        link.hidden = !normalize(link.textContent).includes(query);
        if (!link.hidden) count++;
    });
    document.querySelector('.empty-search').hidden = count > 0;
});
document.querySelector('#expand')?.addEventListener('click', () => document.querySelectorAll('details').forEach(item => item.open = true));
document.querySelector('#collapse')?.addEventListener('click', () => document.querySelectorAll('details').forEach(item => item.open = false));

document.querySelectorAll('.erd-tools').forEach(tools => {
    const stage = tools.nextElementSibling;
    const svg = stage.querySelector('svg');
    const box = svg.viewBox.baseVal;
    let scale = 1;
    let mode = 'fit';
    let pan = false;
    let offsetX = 0;
    let offsetY = 0;
    const panButton = tools.querySelector('[data-zoom="pan"]');
    const available = () => {
        const style = getComputedStyle(stage);
        return {
            width: stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
            height: stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
        };
    };
    const fitWidth = () => available().width / box.width;
    const update = () => {
        scale = Math.min(4, Math.max(0.001, scale));
        svg.style.width = `${box.width * scale}px`;
        svg.style.height = `${box.height * scale}px`;
        svg.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
        tools.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.zoom === 'pan' ? pan : button.dataset.zoom === mode)));
    };
    const fit = () => {
        scale = mode === 'fit' ? Math.min(fitWidth(), available().height / box.height) : fitWidth();
        update();
    };
    const showStart = () => {
        const space = available();
        offsetX = Math.max(0, (space.width - box.width * scale) / 2);
        offsetY = mode === 'fit' ? Math.max(0, (space.height - box.height * scale) / 2) : 0;
        update();
    };
    tools.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
        const action = button.dataset.zoom;
        if (action === 'pan') {
            pan = !pan;
            stage.classList.toggle('pan-enabled', pan);
            panButton.setAttribute('aria-pressed', String(pan));
            return;
        }
        if (action === 'fullscreen') return;
        const previous = scale;
        const centerX = (stage.clientWidth / 2 - offsetX) / previous;
        const centerY = (stage.clientHeight / 2 - offsetY) / previous;
        mode = action;
        if (action === 'width' || action === 'fit') {
            fit();
            showStart();
            return;
        }
        scale = action === 'reset' ? 1 : scale * (action === 'in' ? 1.25 : 0.8);
        offsetX = stage.clientWidth / 2 - centerX * scale;
        offsetY = stage.clientHeight / 2 - centerY * scale;
        update();
    }));
    fit();
    showStart();
    let drag;
    stage.addEventListener('pointerdown', event => {
        if (!pan || event.button !== 0 || event.target.closest('a')) return;
        drag = { x: event.clientX, y: event.clientY, left: offsetX, top: offsetY };
        stage.setPointerCapture(event.pointerId);
        stage.classList.add('dragging');
        event.preventDefault();
    });
    stage.addEventListener('pointermove', event => {
        if (!drag) return;
        offsetX = drag.left + event.clientX - drag.x;
        offsetY = drag.top + event.clientY - drag.y;
        update();
    });
    const endDrag = () => { drag = null; stage.classList.remove('dragging'); };
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);
    stage.addEventListener('lostpointercapture', endDrag);
    tools.querySelector('[data-zoom="fullscreen"]')?.addEventListener('click', async () => {
        const viewer = tools.parentElement;
        try {
            if (document.fullscreenElement) await document.exitFullscreen();
            else await viewer.requestFullscreen();
        } catch { /* The width and zoom controls remain usable without fullscreen. */ }
    });
    new ResizeObserver(() => {
        if (mode === 'width' || mode === 'fit') { fit(); showStart(); }
    }).observe(stage);
    window.addEventListener('resize', () => {
        if (mode === 'width' || mode === 'fit') { fit(); showStart(); }
    });
});
window.addEventListener('beforeprint', () => document.querySelectorAll('details').forEach(item => {
    item.dataset.wasOpen = String(item.open);
    item.open = true;
}));
window.addEventListener('afterprint', () => document.querySelectorAll('details').forEach(item => item.open = item.dataset.wasOpen === 'true'));
