// --- 动态加载头部和尾部 ---
async function loadComponent(url, placeholderId, isHeader = false) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Could not load ${url}: ${response.statusText}`);
        const text = await response.text();
        const placeholder = document.getElementById(placeholderId);
        if (placeholder) {
            // 使用 innerHTML 替换占位符内容，而不是替换占位符本身
            placeholder.innerHTML = text;
            if (isHeader) {
                initializeHeaderScripts(); // 如果是头部，则初始化相关脚本
            }
        }
    } catch (error) {
        console.error('Failed to load component:', error);
    }
}

async function loadLayout() {
    // 标记正在加载的是头部
    await loadComponent('includes/header.html', 'header-placeholder', true); 
    // 加载页脚
    await loadComponent('includes/footer.html', 'footer-placeholder', false);
}

// --- 初始化头部相关脚本的函数 ---
function initializeHeaderScripts() {
    // --- 高亮当前页面的导航链接 ---
    const currentPageFile = window.location.pathname.split('/').pop() || 'index.html';
    
    if (currentPageFile === 'index.html') {
        // 如果是首页，只高亮“首页”链接
        const homeLink = document.querySelector('.nav-menu a.nav-link[href="index.html"]');
        if (homeLink) {
            homeLink.classList.add('active-page');
        }
    } else {
        // 如果是其他页面（产品详情页等），执行产品页的高亮逻辑
        // 查找所有导航链接（包括主导航和下拉菜单）
        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('id');
        const navLinks = document.querySelectorAll('.nav-link, .dropdown-item');

        navLinks.forEach(link => {
            const linkHref = link.getAttribute('href');
            const linkFile = linkHref.split('/').pop().split('?')[0].split('#')[0] || 'index.html';

            // 检查文件名是否匹配。对于动态产品页，同时检查URL参数是否匹配。
            let isActive = false;
            if (linkFile === 'product.html' && productId) {
                isActive = linkHref.includes(`id=${productId}`);
            } else {
                isActive = (linkFile === currentPageFile);
            }

            if (isActive) {
                link.classList.add('active-page'); // 添加高亮类

                // 如果是下拉菜单中的项，也高亮其父级导航项
                const parentDropdown = link.closest('.dropdown');
                if (parentDropdown) {
                    const parentNavLink = parentDropdown.querySelector('.nav-link');
                    if (parentNavLink) {
                        parentNavLink.classList.add('active-page');
                    }
                }
            }
        });
    }

    // --- 移动端汉堡菜单逻辑 ---
    const hamburger = document.querySelector(".hamburger");
    const navMenu = document.querySelector(".nav-menu");
    const navLinks = document.querySelectorAll(".nav-menu .nav-link");

    // 禁用导航菜单的拼写检查，以移除浏览器添加的红色下划线
    if (navMenu) {
        navMenu.setAttribute('id', 'nav-menu'); // 为 a11y 添加 ID
        navMenu.setAttribute('spellcheck', 'false');
    }

    function toggleMenu() {
        hamburger.classList.toggle("active");
        navMenu.classList.toggle("active");
        hamburger.setAttribute('aria-expanded', isOpened); // 更新 ARIA 属性
    }

    // 关闭整个菜单的函数
    function closeMenu() {
        if (navMenu && navMenu.classList.contains("active")) {
            hamburger.classList.remove("active");
            navMenu.classList.remove("active");
            hamburger.setAttribute('aria-expanded', 'false'); // 更新 ARIA 属性
        }
    }

    // 移动端菜单链接点击事件处理
    function handleMenuLinkClick(event) {
        const clickedLink = event.currentTarget;
        const parentItem = clickedLink.parentElement;

        // 检查被点击的链接是否是用于展开下拉菜单的
        const isDropdownToggle = parentItem.classList.contains('dropdown');

        if (isDropdownToggle) {
            // 仅在移动端视图下阻止链接的默认跳转行为，以实现手风琴效果
            // window.innerWidth <= 768 匹配 CSS 中的响应式断点
            if (window.innerWidth <= 768) {
                event.preventDefault(); // 在移动端，阻止链接跳转，仅展开菜单
            } else {
                return; // 在桌面端，不阻止事件，允许链接正常跳转
            }

            // 手风琴效果：在展开当前菜单前，关闭其他所有已展开的菜单
            const allDropdowns = navMenu.querySelectorAll('.dropdown');
            allDropdowns.forEach(dropdown => {
                if (dropdown !== parentItem) {
                    dropdown.classList.remove('open');
                    // 更新其他下拉菜单的 ARIA 状态
                    dropdown.querySelector('.nav-link').setAttribute('aria-expanded', 'false');
                }
            });

            // 切换当前点击菜单的展开/收起状态
            const isOpening = parentItem.classList.toggle('open');
            // 更新当前下拉菜单的 ARIA 状态
            clickedLink.setAttribute('aria-expanded', isOpening);
        } else {
            // 如果是普通链接（非下拉菜单触发器），则关闭整个导航
            closeMenu();
        }
    }

    if (hamburger) hamburger.addEventListener("click", toggleMenu);
    if (navLinks) navLinks.forEach(link => link.addEventListener("click", handleMenuLinkClick));

    // --- 点击菜单外部区域关闭菜单 ---
    document.addEventListener('click', function(event) {
        // 确保菜单和汉堡按钮已加载
        if (!navMenu || !hamburger) return;

        // 检查菜单是否为激活状态，并且点击的目标不是菜单本身或汉堡按钮
        const isClickInsideMenu = navMenu.contains(event.target);
        const isClickOnHamburger = hamburger.contains(event.target);

        if (navMenu.classList.contains('active') && !isClickInsideMenu && !isClickOnHamburger) {
            closeMenu();
        }
    });

    // --- 产品筛选逻辑 ---
    const filterLinks = document.querySelectorAll(".filter-link");
    if (filterLinks.length > 0) {
        filterLinks.forEach(link => {
            link.addEventListener("click", handleFilterClick);
        });
    }

    // 页面加载时根据URL参数或默认值应用筛选
    const urlParams = new URLSearchParams(window.location.search);
    const categoryFromUrl = urlParams.get('category') || 'all';
    applyFilter(categoryFromUrl);
}

// 筛选链接点击事件处理函数
function handleFilterClick(e) {
    const link = e.currentTarget;
    const selectedCategory = link.getAttribute("data-category");

    // 判断是否在首页 (通过 hero section 判断)
    if (document.getElementById('hero')) { 
        e.preventDefault();
        const url = new URL(window.location);
        url.searchParams.set('category', selectedCategory);
        // 更新URL并滚动到产品区
        history.pushState({category: selectedCategory}, '', url.pathname + url.search + '#products');
        applyFilter(selectedCategory);
    }
    // 如果不在首页，则a标签的默认href行为（跳转到首页并带上参数）是正确的，无需阻止。
}

// 封装筛选逻辑为一个函数
function applyFilter(category) {
    const filterLinks = document.querySelectorAll(".filter-link");
    const productCards = document.querySelectorAll(".product-card");

    // 更新导航链接的激活状态
    if (filterLinks.length > 0) {
        filterLinks.forEach(item => {
            item.classList.toggle('active-filter', item.getAttribute('data-category') === category);
        });
    }

    // 筛选产品卡片
    if (productCards.length > 0) {
        productCards.forEach(card => {
            const cardCategory = card.getAttribute("data-category");
            const shouldShow = (category === "all" || category === cardCategory);
            card.classList.toggle('hide', !shouldShow);
        });
    }
}

// --- 联系表单提交逻辑 ---
function initializeContactForm() {
    const contactForm = document.getElementById('contact-form');
    const formStatus = document.getElementById('form-status');

    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault(); // 阻止表单默认提交行为

            const form = e.target;
            const data = new FormData(form);
            const action = "https://formsubmit.co/jincapp@gmail.com"; // 替换成你的邮箱

            formStatus.textContent = '正在发送...';
            formStatus.style.color = '#555';

            fetch(action, {
                method: 'POST',
                body: data,
                headers: {
                    'Accept': 'application/json'
                }
            }).then(response => {
                if (response.ok) {
                    formStatus.textContent = '感谢您的留言，我们已收到您的讯息！';
                    formStatus.style.color = 'green';
                    form.reset(); // 提交成功后清空表单
                } else {
                    formStatus.textContent = '提交失败，请稍后再试。';
                    formStatus.style.color = 'red';
                }
            }).catch(error => {
                formStatus.textContent = '网络错误，请检查您的网络连接。';
                formStatus.style.color = 'red';
            });
        });
    }
}

// --- 页面加载时根据URL参数自动筛选产品 ---
document.addEventListener('DOMContentLoaded', () => {
    loadLayout();
    loadProductDetails(); // 新增：加载产品详情页内容
    initializeContactForm();
    setupBackToTopButton(); // 设置“返回顶部”按钮
    initializeImageGallery(); // 新增：初始化图片画廊
    setupWhatsAppButton(); // 新增：设置 WhatsApp 按钮
});

// --- 产品详情页动态加载逻辑 ---
async function loadProductDetails() {
    // 仅在 product.html 页面执行
    if (!window.location.pathname.endsWith('product.html')) {
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    const mainContent = document.querySelector('main');

    if (!productId) {
        mainContent.innerHTML = '<div class="content-section"><h1>产品未找到</h1><p>请检查您的链接是否正确。</p></div>';
        return;
    }

    try {
        const response = await fetch('products.json');
        if (!response.ok) throw new Error('无法加载产品数据。');
        const products = await response.json();
        const product = products[productId];

        if (product) {
            // 更新页面标题和元描述
            document.title = product.titleTag || `Coway ${product.name}`;
            const metaDesc = document.getElementById('meta-description');
            if (metaDesc) metaDesc.setAttribute('content', product.metaDescription || '');

            // 更新产品横幅和主图
            const bannerImage = document.getElementById('product-banner-image');
            if (bannerImage) {
                bannerImage.src = product.bannerImage;
                bannerImage.alt = `${product.name} 横幅`;
            }
            document.getElementById('product-image').src = product.image;
            document.getElementById('product-image').alt = product.name;

            // 更新产品信息
            document.getElementById('product-title').textContent = product.name;
            document.getElementById('product-description').textContent = product.description;

            // 动态生成规格表
            const specsTableBody = document.getElementById('specs-table-body');
            specsTableBody.innerHTML = ''; // 清空现有内容
            for (const [key, value] of Object.entries(product.specs)) {
                const row = `<tr><td>${key}</td><td>${value}</td></tr>`;
                specsTableBody.innerHTML += row;
            }

            // 更新价格信息
            document.getElementById('product-price').innerHTML = product.priceHTML;
        } else {
            throw new Error(`ID为 "${productId}" 的产品未在 products.json 中找到。`);
        }
    } catch (error) {
        console.error('加载产品详情时出错:', error);
        mainContent.innerHTML = `<div class="content-section"><h1>加载失败</h1><p>${error.message}</p></div>`;
    }
}

// 监听浏览器前进/后退事件
window.addEventListener('popstate', (event) => {
    const urlParams = new URLSearchParams(window.location.search);
    const category = urlParams.get('category') || 'all';
    applyFilter(category);
});

// --- "返回顶部" 按钮逻辑 ---
function setupBackToTopButton() {
    // 1. 动态创建按钮元素
    const backToTopButton = document.createElement('a');
    // backToTopButton.setAttribute('href', '#'); // 移除此行，防止页面跳转和产生空白
    backToTopButton.setAttribute('aria-label', '返回顶部');
    backToTopButton.classList.add('back-to-top');
    backToTopButton.innerHTML = '<i class="fas fa-arrow-up"></i>'; // 使用 Font Awesome 图标

    // 2. 将按钮添加到页面中
    document.body.appendChild(backToTopButton);

    // 3. 监听滚动事件，控制按钮的显示和隐藏
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) { // 当页面向下滚动超过 300px 时显示按钮
            backToTopButton.classList.add('show');
        } else {
            backToTopButton.classList.remove('show');
        }
    });

    // 4. 监听点击事件，平滑滚动到页面顶部
    backToTopButton.addEventListener('click', (e) => {
        e.preventDefault(); // 阻止链接的默认跳转行为
        // window.scrollTo({ top: 0, behavior: 'smooth' }); // 使用自定义缓动函数替代，提供更平滑的体验
        scrollToTop(800); // 800毫秒内滚动到顶部，您可以调整这个数值来改变速度
    });
}

/**
 * 在指定时间内平滑滚动到页面顶部
 * @param {number} duration 滚动持续时间（毫秒）
 */
function scrollToTop(duration) {
    const startPosition = window.pageYOffset;
    const distance = -startPosition;
    let startTime = null;

    // easeInOutCubic 缓动函数，实现 "慢-快-慢" 的平滑效果
    const easeInOutCubic = t => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;

    function animation(currentTime) {
        if (startTime === null) startTime = currentTime;
        const timeElapsed = currentTime - startTime;
        const progress = Math.min(timeElapsed / duration, 1);
        const easedProgress = easeInOutCubic(progress);

        const run = startPosition + distance * easedProgress;
        window.scrollTo(0, run);
        if (timeElapsed < duration) requestAnimationFrame(animation);
    }

    requestAnimationFrame(animation);
}

// --- 图片画廊左右滚动按钮逻辑 ---
function initializeImageGallery() {
    const galleryWrapper = document.querySelector('.image-gallery-wrapper');
    if (!galleryWrapper) return;

    const scrollContainer = galleryWrapper.querySelector('.image-gallery-scroll-container');
    const prevBtn = galleryWrapper.querySelector('.prev-btn');
    const nextBtn = galleryWrapper.querySelector('.next-btn');

    if (!scrollContainer || !prevBtn || !nextBtn) return;

    const scrollAmount = () => {
        // 每次滚动一张图片的宽度
        return scrollContainer.querySelector('img').clientWidth;
    };

    nextBtn.addEventListener('click', () => {
        scrollContainer.scrollBy({ left: scrollAmount(), behavior: 'smooth' });
    });

    prevBtn.addEventListener('click', () => {
        scrollContainer.scrollBy({ left: -scrollAmount(), behavior: 'smooth' });
    });
}


// --- WhatsApp 悬浮按钮逻辑 ---
function setupWhatsAppButton() {
    // 1. 动态创建按钮元素
    const whatsAppButton = document.createElement('a');
    whatsAppButton.href = 'https://wa.me/60108683955';
    whatsAppButton.target = '_blank';
    whatsAppButton.setAttribute('aria-label', '通过WhatsApp联系我们');
    whatsAppButton.classList.add('whatsapp-float');
    
    const whatsAppIcon = document.createElement('img');
    whatsAppIcon.src = 'images/whatsapp-icon.png';
    whatsAppIcon.alt = '通过WhatsApp联系我们';
    whatsAppButton.appendChild(whatsAppIcon);

    // 2. 将按钮添加到页面中
    document.body.appendChild(whatsAppButton);
}