/* Ocean Legacy Miniatures - automatic invoice generator (standalone) */
(function () {
    'use strict';

    // Product list - edit prices here if they change on the Products page
    var PRODUCTS = [
        { name: 'Spanish Galleon (1588, 18 inch, Teak)', price: 15000 },
        { name: 'Mayflower (1620, 15 inch, Rosewood)', price: 12500 },
        { name: 'Black Pearl - Limited (1715, 20 inch)', price: 18000 },
        { name: 'Merchant Brig (1750, 16 inch, Teak)', price: 13000 },
        { name: 'HMS Victory (1805, 24 inch, Museum Quality)', price: 25000 },
        { name: 'Budget Model (8 inch)', price: 3500 }
    ];

    var COMPANY = {
        name: 'OCEAN LEGACY',
        sub: 'MINIATURES',
        address: 'Near Clock Tower, Sialkot, Punjab, Pakistan',
        phone: '+92 300 0000000',
        email: 'oceanlegacy@email.com'
    };

    var KEY_COUNTER = 'olm_invoice_counter';
    var KEY_HISTORY = 'olm_invoice_history';

    function $(id) { return document.getElementById(id); }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function money(n) { return 'Rs. ' + Math.round(n || 0).toLocaleString('en-US'); }
    function num(v) { var n = parseFloat(v); return isNaN(n) || n < 0 ? 0 : n; }

    function read(key, fallback) {
        try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
        catch (e) { return fallback; }
    }
    function write(key, val) {
        try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* storage blocked */ }
    }

    var counter = read(KEY_COUNTER, 0);
    var lockedNo = null; // set once an invoice is saved/loaded, so its number never changes

    function todayISO() {
        var d = new Date();
        var m = ('0' + (d.getMonth() + 1)).slice(-2);
        var day = ('0' + d.getDate()).slice(-2);
        return d.getFullYear() + '-' + m + '-' + day;
    }
    function buildNo() {
        var d = ($('invDate').value || todayISO()).replace(/-/g, '');
        return 'OLM-' + d + '-' + ('00' + (counter + 1)).slice(-3);
    }
    function currentNo() { return lockedNo || buildNo(); }

    function prettyDate(iso) {
        var p = (iso || todayISO()).split('-');
        var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return parseInt(p[2], 10) + ' ' + months[parseInt(p[1], 10) - 1] + ' ' + p[0];
    }

    /* ---------- item rows ---------- */
    function addRow(item) {
        var row = document.createElement('div');
        row.className = 'inv-row';
        var opts = PRODUCTS.map(function (p, i) {
            return '<option value="' + i + '">' + esc(p.name) + '</option>';
        }).join('');
        row.innerHTML =
            '<select class="r-prod">' + opts + '<option value="custom">Custom item...</option></select>' +
            '<input type="number" class="r-qty" min="1" value="1">' +
            '<input type="number" class="r-price" min="0" value="0">' +
            '<button type="button" class="r-del" title="Remove">&times;</button>' +
            '<input type="text" class="r-name" placeholder="Describe the custom item" style="display:none">';
        $('items').appendChild(row);

        var sel = row.querySelector('.r-prod');
        var nameIn = row.querySelector('.r-name');
        var priceIn = row.querySelector('.r-price');
        var qtyIn = row.querySelector('.r-qty');

        if (item) {
            var idx = -1;
            PRODUCTS.forEach(function (p, i) { if (p.name === item.name) idx = i; });
            if (idx >= 0) { sel.value = String(idx); }
            else { sel.value = 'custom'; nameIn.value = item.name; nameIn.style.display = ''; }
            qtyIn.value = item.qty;
            priceIn.value = item.price;
        } else {
            priceIn.value = PRODUCTS[0].price;
        }

        sel.addEventListener('change', function () {
            if (sel.value === 'custom') { nameIn.style.display = ''; nameIn.focus(); }
            else { nameIn.style.display = 'none'; priceIn.value = PRODUCTS[parseInt(sel.value, 10)].price; }
            render();
        });
        row.querySelector('.r-del').addEventListener('click', function () {
            row.remove();
            if (!$('items').children.length) addRow();
            render();
        });
    }

    function getItems() {
        var out = [];
        var rows = $('items').children;
        for (var i = 0; i < rows.length; i++) {
            var r = rows[i];
            var v = r.querySelector('.r-prod').value;
            var name = v === 'custom' ? r.querySelector('.r-name').value.trim() : PRODUCTS[parseInt(v, 10)].name;
            var qty = Math.max(1, Math.round(num(r.querySelector('.r-qty').value)) || 1);
            var price = num(r.querySelector('.r-price').value);
            if (name || price) out.push({ name: name || 'Custom item', qty: qty, price: price });
        }
        return out;
    }

    /* ---------- calculations ---------- */
    function calc(items) {
        var subtotal = items.reduce(function (s, it) { return s + it.qty * it.price; }, 0);
        var discount = subtotal * Math.min(num($('discount').value), 100) / 100;
        var taxable = subtotal - discount;
        var tax = taxable * num($('tax').value) / 100;
        var shipping = num($('shipping').value);
        var total = taxable + tax + shipping;
        var advance = Math.min(num($('advance').value), total);
        return { subtotal: subtotal, discount: discount, tax: tax, shipping: shipping, total: total, advance: advance, balance: total - advance };
    }

    /* ---------- render invoice ---------- */
    function render() {
        var items = getItems();
        var t = calc(items);
        var no = currentNo();
        $('invNoField').value = no;

        var rows = items.map(function (it, i) {
            return '<tr><td>' + (i + 1) + '</td><td>' + esc(it.name) + '</td>' +
                '<td class="num">' + it.qty + '</td><td class="num">' + money(it.price) + '</td>' +
                '<td class="num">' + money(it.qty * it.price) + '</td></tr>';
        }).join('') || '<tr><td colspan="5" style="color:#999">No items added</td></tr>';

        var cust = [
            $('cName').value.trim() || 'Customer Name',
            $('cPhone').value.trim(),
            $('cEmail').value.trim(),
            $('cAddress').value.trim(),
            $('cCountry').value
        ].filter(Boolean).map(esc).join('<br>');

        var html =
            (t.total > 0 && t.balance <= 0 ? '<div class="i-stamp">PAID</div>' : '') +
            '<div class="i-head"><div>' +
            '<div class="i-brand">' + COMPANY.name + ' <span>' + COMPANY.sub + '</span></div>' +
            '<div class="i-small">' + esc(COMPANY.address) + '<br>' + esc(COMPANY.phone) + '<br>' + esc(COMPANY.email) + '</div>' +
            '</div><div class="i-title"><h2>INVOICE</h2>' +
            '<div class="i-small"><strong>' + esc(no) + '</strong><br>Date: ' + esc(prettyDate($('invDate').value)) + '</div></div></div>' +
            '<div class="i-meta"><div><h5>BILL TO</h5>' + cust + '</div></div>' +
            '<table><thead><tr><th>#</th><th>Description</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Amount</th></tr></thead><tbody>' +
            rows + '</tbody></table>' +
            '<div class="i-totals">' +
            '<div><span>Subtotal</span><span>' + money(t.subtotal) + '</span></div>' +
            (t.discount ? '<div><span>Discount (' + num($('discount').value) + '%)</span><span>- ' + money(t.discount) + '</span></div>' : '') +
            (t.tax ? '<div><span>Tax (' + num($('tax').value) + '%)</span><span>' + money(t.tax) + '</span></div>' : '') +
            (t.shipping ? '<div><span>Shipping</span><span>' + money(t.shipping) + '</span></div>' : '') +
            '<div class="grand"><span>Total</span><span>' + money(t.total) + '</span></div>' +
            (t.advance ? '<div><span>Advance Paid</span><span>- ' + money(t.advance) + '</span></div>' : '') +
            '<div class="due"><span>Balance Due</span><span>' + money(t.balance) + '</span></div>' +
            '</div>' +
            ($('notes').value.trim() ? '<div class="i-notes">' + esc($('notes').value.trim()).replace(/\n/g, '<br>') + '</div>' : '');

        $('invoice').innerHTML = html;
    }

    /* ---------- save / history ---------- */
    function collect() {
        return {
            no: currentNo(),
            date: $('invDate').value,
            name: $('cName').value, phone: $('cPhone').value, email: $('cEmail').value,
            address: $('cAddress').value, country: $('cCountry').value,
            items: getItems(),
            discount: $('discount').value, shipping: $('shipping').value,
            tax: $('tax').value, advance: $('advance').value, notes: $('notes').value,
            total: calc(getItems()).total
        };
    }

    function fill(d) {
        $('invDate').value = d.date || todayISO();
        $('cName').value = d.name || ''; $('cPhone').value = d.phone || '';
        $('cEmail').value = d.email || ''; $('cAddress').value = d.address || '';
        $('cCountry').value = d.country || 'Pakistan';
        $('discount').value = d.discount || 0; $('shipping').value = d.shipping || 0;
        $('tax').value = d.tax || 0; $('advance').value = d.advance || 0;
        $('notes').value = d.notes || '';
        $('items').innerHTML = '';
        (d.items && d.items.length ? d.items : [null]).forEach(function (it) { addRow(it); });
    }

    function saveInvoice() {
        if (!lockedNo) {
            lockedNo = buildNo();
            counter += 1;
            write(KEY_COUNTER, counter);
        }
        var data = collect();
        var list = read(KEY_HISTORY, []).filter(function (x) { return x.no !== data.no; });
        list.unshift(data);
        write(KEY_HISTORY, list.slice(0, 50));
        renderHistory();
    }

    function renderHistory() {
        var list = read(KEY_HISTORY, []);
        var box = $('history');
        if (!list.length) { box.innerHTML = '<p class="h-empty">No saved invoices yet.</p>'; return; }
        box.innerHTML = list.map(function (x) {
            return '<div class="h-item"><div><strong>' + esc(x.no) + '</strong><br>' +
                esc(x.name || 'No name') + ' - ' + money(x.total) + '</div>' +
                '<div class="h-btns"><button data-act="load" data-no="' + esc(x.no) + '">Open</button>' +
                '<button data-act="del" data-no="' + esc(x.no) + '">Delete</button></div></div>';
        }).join('');
    }

    function newInvoice() {
        lockedNo = null;
        fill({ date: todayISO(), notes: $('notes').defaultValue });
        render();
    }

    /* ---------- wire up ---------- */
    document.addEventListener('DOMContentLoaded', function () {
        $('invDate').value = todayISO();
        addRow();
        renderHistory();
        render();

        document.querySelector('.inv-form').addEventListener('input', render);
        $('invDate').addEventListener('change', render);
        $('addItem').addEventListener('click', function () { addRow(); render(); });
        $('printBtn').addEventListener('click', function () {
            if (!getItems().length) { alert('Please add at least one item.'); return; }
            saveInvoice();
            render();
            window.print();
        });
        $('newBtn').addEventListener('click', newInvoice);

        $('history').addEventListener('click', function (e) {
            var b = e.target.closest('button');
            if (!b) return;
            var no = b.getAttribute('data-no');
            var list = read(KEY_HISTORY, []);
            if (b.getAttribute('data-act') === 'del') {
                write(KEY_HISTORY, list.filter(function (x) { return x.no !== no; }));
                if (lockedNo === no) lockedNo = null;
                renderHistory();
                render();
            } else {
                var found = list.filter(function (x) { return x.no === no; })[0];
                if (found) { lockedNo = found.no; fill(found); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
            }
        });
    });
})();
