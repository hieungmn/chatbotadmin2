document.querySelector('.menu-toggle')?.addEventListener('click', event => {
    const open = document.body.classList.toggle('menu-open');
    event.currentTarget.setAttribute('aria-expanded', String(open));
});

document.querySelectorAll('.sidebar a').forEach(link => link.addEventListener('click', () => {
    document.body.classList.remove('menu-open');
    document.querySelector('.menu-toggle')?.setAttribute('aria-expanded', 'false');
}));

const sectionLinks = [...document.querySelectorAll('.section-links a')];
const sections = sectionLinks.map(link => document.getElementById(decodeURIComponent(link.hash.slice(1)))).filter(Boolean);
if (sections.length) {
    const updateSection = () => {
        let current = sections[0];
        for (const section of sections) if (section.getBoundingClientRect().top <= 140) current = section;
        if (window.scrollY > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 3) current = sections[sections.length - 1];
        sectionLinks.forEach(link => {
            if (decodeURIComponent(link.hash.slice(1)) === current.id) link.setAttribute('aria-current', 'location');
            else link.removeAttribute('aria-current');
        });
    };
    window.addEventListener('scroll', updateSection, { passive: true });
    window.addEventListener('hashchange', updateSection);
    updateSection();
}

document.querySelector('.print')?.addEventListener('click', () => window.print());
