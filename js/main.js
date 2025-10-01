// --- 动态加载头部和尾部 ---
async function loadComponent(url, placeholderId) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Could not load ${url}: ${response.statusText}`);
        const text = await response.text();
        const placeholder = document.getElementById(placeholderId);
        if (placeholder) {
            placeholder.outerHTML = text;
        }
    } catch (error) {
        console.error('Failed to load component:', error);
    }
}

async function loadLayout() {
    await loadComponent('includes/header.html', 'header-placeholder');
    await loadComponent('includes/footer.html', 'footer-placeholder');
    initializePage(); // 加载完布局后，初始化页面上的其他脚本
}

// --- 移动端汉堡菜单逻辑 ---
const hamburger = document.querySelector(".hamburger");
const navMenu = document.querySelector(".nav-menu");
const navLinks = document.querySelectorAll(".nav-link");

function toggleMenu() {
    hamburger.classList.toggle("active");
    navMenu.classList.toggle("active");
}

function closeMenu() {
    if (hamburger.classList.contains("active")) {
        hamburger.classList.remove("active");
        navMenu.classList.remove("active");
    }
}

hamburger.addEventListener("click", toggleMenu);
navLinks.forEach(link => link.addEventListener("click", closeMenu));

// --- 产品筛选逻辑 ---
const filterLinks = document.querySelectorAll(".filter-link");
const productCards = document.querySelectorAll(".product-card");

// 初始化产品视图函数
function initializeProductView() {
    const activeFilter = document.querySelector('.filter-link.active-filter');
    const initialCategory = activeFilter ? activeFilter.getAttribute('data-category') : 'all';

    productCards.forEach(card => {
        const cardCategory = card.getAttribute("data-category");
        const shouldShow = (initialCategory === "all" || initialCategory === cardCategory);
        card.classList.toggle('hide', !shouldShow);
    });
}

filterLinks.forEach(link => {
    link.addEventListener("click", function(e) {
        e.preventDefault(); // 阻止链接默认的跳转行为

        const selectedCategory = this.getAttribute("data-category");
        
        // 使用 History API 更新 URL，而不是直接跳转
        const url = new URL(window.location);
        url.searchParams.set('category', selectedCategory);
        // 使用 pushState 更新历史记录
        history.pushState({category: selectedCategory}, '', url);

        // 手动调用筛选函数
        applyFilter(selectedCategory);
    });
});

// 封装筛选逻辑为一个函数
function applyFilter(category) {
    // 更新导航链接的激活状态
    filterLinks.forEach(item => {
        item.classList.toggle('active-filter', item.getAttribute('data-category') === category);
    });

    // 筛选产品卡片
    productCards.forEach(card => {
        const cardCategory = card.getAttribute("data-category");
        const shouldShow = (category === "all" || category === cardCategory);
        card.classList.toggle('hide', !shouldShow);
    });
}

// --- 联系表单提交逻辑 ---
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

// --- 页面加载时根据URL参数自动筛选产品 ---
document.addEventListener('DOMContentLoaded', () => {
    // 首先，根据HTML中的 active-filter 初始化视图
    initializeProductView();

    // 1. 页面首次加载时，根据URL参数筛选
    const urlParams = new URLSearchParams(window.location.search);
    const categoryFromUrl = urlParams.get('category');

    if (categoryFromUrl) {
        applyFilter(categoryFromUrl);
    }
});

// 监听浏览器前进/后退事件
window.addEventListener('popstate', (event) => {
    const urlParams = new URLSearchParams(window.location.search);
    const category = urlParams.get('category');
    if (category) {
        applyFilter(category);
    } else {
        applyFilter('all'); // 如果没有分类参数，则显示全部
    }
});

// --- 页面初始化总入口 ---
function initializePage() {
    // 这里放置所有需要在布局加载后执行的代码
    // （目前，所有代码都可以直接运行，因为它们是基于事件监听的）
}

document.addEventListener('DOMContentLoaded', loadLayout);

// --- "返回顶部" 按钮逻辑 ---
function setupBackToTopButton() {
    // 1. 动态创建按钮元素
    const backToTopButton = document.createElement('a');
    backToTopButton.setAttribute('href', '#'); // 使用'#'作为备用链接
    backToTopButton.setAttribute('aria-label', '返回顶部');
    backToTopButton.classList.add('back-to-top');
    backToTopButton.innerHTML = '<img src="images/back-top_icon.png" alt="返回顶部">'; // 使用图片作为按钮图标

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

document.addEventListener('DOMContentLoaded', setupBackToTopButton);