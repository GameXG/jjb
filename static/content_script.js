// 京价宝
async function getNowPrice(sku) {
    var data = ''
    try {
        let resp = await fetch('https://item.m.jd.com/product/' + sku + '.html')
        data = await resp.text()
    } catch (e) {
        var request = new XMLHttpRequest();
        request.open('GET', 'https://item.m.jd.com/product/' + sku + '.html', false);
        request.send(null);
        if (request.status === 200) {
            data = request.responseText
        } else {
            throw new  Error('GET Error')
        }
    }
    var product_name = $(data).find('.title-text').text()
    var normal_price = $(data).find('#specJdPrice').text()
    var spec_price = $(data).find('#spec_price').text()
    var spec_plus_price = $(data).find('#specPlusPrice').text()

    console.log(product_name + '最新价格', Number(normal_price), 'or', Number(spec_price) , 'or' ,Number(spec_plus_price))

    if(spec_plus_price){
        // 开通plus的广告
        var open_plus_icon = $(data).find(".open-plus-icon")
        console.log("open_plus_icon:",open_plus_icon)
        if (open_plus_icon.size()===0){
            return Number(spec_plus_price)
        }
    }

    if (normal_price) {
        return Number(normal_price)
    } else {
        return Number(spec_price)
    }
}

async function dealProduct(product, order_info) {
    console.log('dealProduct', product)
    var success_logs = []
    var product_name = product.find('.item-name .name').text()
    var order_price = Number(product.find('.item-opt .price').text().trim().substring(1))
    var order_sku = product.find('.item-opt .apply').attr('id').split('_')
    var order_quantity =  Number(product.find('.item-name .count').text().trim())
    var order_success_logs = product.next().find('.ajaxFecthState .jb-has-succ').text()
    console.log('发现有效的订单', product_name, order_price)

    if (order_success_logs && typeof order_success_logs == "object") {
        order_success_logs.forEach(function(log) {
            if (log) {
                success_logs.push(log.trim())
            }
        });
    }

    if (typeof order_success_logs == "string") {
        success_logs.push(order_success_logs.trim())
    }


    var new_price = await getNowPrice(order_sku[2])
    console.log(product_name + '进行价格对比:', new_price, ' Vs ', order_price)
    order_info.goods.push({
        name: product_name,
        order_price: order_price,
        new_price: new_price,
        success_log: success_logs,
        quantity: order_quantity
    })
    if ( new_price > 0 && new_price < order_price ) {
        $(product).find('.item-opt .apply').trigger( "tap" )
        $(product).find('.item-opt .apply').trigger( "click" )
        chrome.runtime.sendMessage({
            text: "notice",
            batch: 'jiabao',
            title: '报告老板，发现价格保护计划！',
            content: product_name + '购买价：'+ order_price + ' 现价：' + new_price + '，已经自动提交价保申请，点击查看申请结果。'
        }, function(response) {
            console.log("Response: ", response);
        });
    }
}


async function dealOrder(order, orders) {
    var dealgoods = []
    var order_time = new Date(order.find('.title span').last().text().trim().split('：')[1])

    console.log('订单时间', order_time)
    // 如果订单时间在15天以内
    if ( new Date().getTime() - order_time.getTime() < 15*24*3600*1000) {
        var order_info = {
            time: order_time,
            goods: []
        }
        console.log(order.find('.product-item'))

        order.find('.product-item').each(function() {
            dealgoods.push(dealProduct($(this), order_info))
        })

        await Promise.all(dealgoods)
        console.log('order_info', order_info)
        orders.push(order_info)
    }
}

async function getAllOrders() {
    console.log('京价宝开始自动检查订单')
    let orders = []
    let dealorders = []
    $( "#datas li" ).each(function() {
        dealorders.push(dealOrder($(this), orders))
    });
    await Promise.all(dealorders)
    chrome.runtime.sendMessage({
        text: "orders",
        content: JSON.stringify(orders)
    }, function(response) {
        console.log("Response: ", response);
    });
    localStorage.setItem('jjb_last_check', new Date().getTime());
}

var auto_login_html = "<p class='auto_login'><input type='checkbox' id='jjbAutoLogin'><label for='jjbAL'>记住密码，并为我自动登录（京价宝提供）</label></p>";



function CheckBaitiaoCouponDom() {
    var time = 0;
    $(".coupon-list .js_coupon").each(function() {
        console.log('开始领券')
        var that = $(this)
        if ($(this).find('.js_getCoupon').text() == '点击领取' ) {
            var coupon_name = that.find('.coupon_lineclamp').text()
            var coupon_price = '面值：' + that.find('.sc-money').text() + ' (' + that.find('.sc-message').text() + ')'
            setTimeout( function(){
                $(that).find('.js_getCoupon').trigger( "tap" )
                $(that).find('.js_getCoupon').trigger( "click" )
                chrome.runtime.sendMessage({
                    text: "coupon",
                    title: "京价宝自动领到一张白条优惠券",
                    content: JSON.stringify({
                        batch: 'baitiao',
                        price: coupon_price,
                        name: coupon_name
                    })
                }, function(response) {
                    console.log("Response: ", response);
                });
            }, time)
            time += 5000;
        }
    })
}

function CheckDom() {
    // 是否登录
    if ( $(".us-line .us-name") && $(".us-line .us-name").length > 0 ) {
        console.log('已经登录')
        chrome.runtime.sendMessage({
            text: "isLogin",
        }, function(response) {
            console.log("Response: ", response);
        });
    };

    // 记住密码
    if ( $(".loginPage").length > 0 ) {
        console.log('登录')
        // 打开了登录页面
        chrome.runtime.sendMessage({
            text: "notLogin",
        }, function(response) {
            console.log("Response: ", response);
        });

        var jjb_username = localStorage.getItem('jjb_username')
        var jjb_password = localStorage.getItem('jjb_password')

        if (jjb_username && jjb_password) {
            var loginBtn = $("#loginBtn")
            $("#username").val(jjb_username)
            $("#password").val(jjb_password)
            $("#loginBtn").addClass("btn-active")
            setTimeout( function(){
                document.getElementById("loginBtn").click();
            }, 500)
        } else {
            $(auto_login_html).insertAfter( ".loginPage .notice" )
            $("#loginBtn").on("click", function () {
                if ($("#jjbAutoLogin").is(":checked")) {
                    var username = $("#username").val()
                    var password = $("#password").val()
                    localStorage.setItem('jjb_username', username)
                    localStorage.setItem('jjb_password', password)
                }
            })
        }
    };


    // PC版自动登录
    if ( $(".login-tab-r ").length > 0 ) {
        var jjb_username = localStorage.getItem('jjb_username')
        var jjb_password = localStorage.getItem('jjb_password')
        $(".login-tab-r a").trigger( "click" )
        if (jjb_username && jjb_password) {
            $("#loginname").val(jjb_username)
            $("#nloginpwd").val(jjb_password)
            setTimeout( function(){
                console.log(".login-btn a")
                $(".login-btn a").trigger( "click" )
            }, 500)
        } else {
            $(auto_login_html).insertAfter( "#formlogin" )
            $(".login-btn a").on("click", function () {
                if ($("#jjbAutoLogin").is(":checked")) {
                    var username = $("#loginname").val()
                    var password = $("#nloginpwd").val()
                    localStorage.setItem('jjb_username', username)
                    localStorage.setItem('jjb_password', password)
                }
            })
        }
    };

    // 会员页签到
    if ( $(".sign-pop").length && !$(".sign-pop").hasClass('signed')) {
        console.log('签到领京豆')
        $(".sign-pop").trigger( "tap" )
        $(".sign-pop").trigger( "click" )
        chrome.runtime.sendMessage({
            text: "checkin_notice",
            title: "京价宝自动为您签到领京豆",
            content: "具体领到多少就不清楚了，大概是3个"
        }, function(response) {
            console.log("Response: ", response);
        });
    };


    // 京东金融签到
    if ( $("#qyy-appSign").length > 0 && $("#appSign-btn").text() == "快抢钢镚") {
        $("#appSign-btn").trigger( "tap" )
        $("#appSign-btn").trigger( "click" )
        chrome.runtime.sendMessage({
            text: "checkin_notice",
            title: "京价宝自动为您签到抢钢镚",
            content: "应该是领到了0.1个钢镚"
        }, function(response) {
            console.log("Response: ", response);
        });
    };


    // 京东支付签到
    if ( $(".signIn .signInBtn").length > 0  && !$(".signInBtn").hasClass('clicked')) {
        $(".signInBtn").trigger( "tap" )
        $(".signInBtn").trigger( "click" )
        chrome.runtime.sendMessage({
            text: "checkin_notice",
            title: "京价宝自动为您签到京东支付",
            content: "应该是领到了几个京豆"
        }, function(response) {
            console.log("Response: ", response);
        });
    };


    // 领取 PLUS 券
    if ( $(".coupon-swiper .coupon-item").length > 0 ) {
        var time = 0;
        console.log('开始领取 PLUS 券')
        $(".coupon-swiper .coupon-item").each(function() {
            var that = $(this)
            if ($(this).find('.get-btn').text() == '立即领取' ) {
                var coupon_name = that.find('.pin-lmt').text()
                var coupon_price = '面值：' + that.find('.cp-val').text() + '元 (' + that.find('.cp-lmt').text() + ')'
                setTimeout( function(){
                    $(that).find('.get-btn').trigger( "click" )
                    chrome.runtime.sendMessage({
                        text: "coupon",
                        title: "京价宝自动领到一张 PLUS 优惠券",
                        content: JSON.stringify({
                            id: '',
                            batch: '',
                            price: coupon_price,
                            name: coupon_name
                        })
                    }, function(response) {
                        console.log("Response: ", response);
                    });
                }, time)
                time += 5000;
            }
        })
    };

    // 单独的领券页面
    if ( $("#js_detail .coupon_get") && $(".coupon_get .js_getCoupon").length > 0) {
        console.log('单独的领券页面', $("#js_detail .coupon_get").find('.js_getCoupon'))
        $("#js_detail .coupon_get").find('.js_getCoupon').trigger( "tap" )
        $("#js_detail .coupon_get").find('.js_getCoupon').trigger( "click" )
    }

    // 领取白条券
    if ( $(".coupon-list .js_coupon") && $(".coupon-list .js_coupon").length > 0 ) {
        console.log('开始领取白条券')
        var time = 0;
        $("#js_categories li").each(function() {
            var that = $(this)
            setTimeout( function(){
                $(that).trigger( "tap" )
                console.log('开始领取', $(that).text())
                setTimeout( CheckBaitiaoCouponDom(), 1000)
            }, time)
            time += 30000;
        })
    };


    // 自动访问店铺领京豆
    if ( $(".bean-shop-list").length > 0 ) {
        console.log('开始自动访问店铺领京豆')
        var time = 0;
        $(".bean-shop-list li").each(function() {
            var that = $(this)
            if ($(that).find('.s-btn').text() == '去签到') {
                setTimeout( function(){
                    chrome.runtime.sendMessage({
                        text: "create_tab",
                        content: JSON.stringify({
                            index: 0,
                            url: $(that).find('.s-btn').attr('href'),
                            active: "false",
                            pinned: "true"
                        })
                    }, function(response) {
                        console.log("Response: ", response);
                    });
                }, time)
                time += 30000;
            }
        })
    };


    if ($(".jShopHeaderArea").length > 0 && $(".jShopHeaderArea .jSign .unsigned").length > 0) {
        setTimeout( function(){
            console.log('店铺自动签到')
            $('.jSign .unsigned').trigger( "click" )
            $('.jSign .unsigned').trigger( "tap" )
        }, 5000)
    }

    if ($(".jShopHeaderArea").length > 0 && $(".jShopHeaderArea .jSign .signed").length > 0) {
        chrome.runtime.sendMessage({
            text: "remove_tab",
            content: JSON.stringify({
                url: window.location.href,
                pinned: "true"
            })
        }, function(response) {
            console.log("Response: ", response);
        });
    }

    // 领取精选券
    if ( $("#couponListUl").length > 0 ) {
        var time = 0;
        $("#couponListUl a.coupon-a").each(function() {
            var that = $(this)
            var coupon_name = that.find('.pro-info').text()
            var coupon_id = that.find("input[class=id]").val()
            var coupon_batch = that.find("input[class=batchId]").val()
            var coupon_price = '面值：' + that.find('.pro-price .big-price').text() + '元 (' + that.find('.pro-price .price-info').text() + ')'
            if ($(this).find('.coupon-btn').text() == '立即领取' ) {
                setTimeout( function(){
                    $(that).find('.coupon-btn').trigger( "click" )
                    chrome.runtime.sendMessage({
                        text: "coupon",
                        title: "京价宝自动领到一张新的优惠券",
                        content: JSON.stringify({
                            id: coupon_id,
                            batch: coupon_batch,
                            price: coupon_price,
                            name: coupon_name
                        })
                    }, function(response) {
                        console.log("Response: ", response);
                    });
                }, time)
                time += 5000;
            }
        })
    };


    // 自动评价
    if ($(".mycomment-form").length > 0) {
        if ($(".commstar-group").length > 0) {
            $('.commstar .star5').trigger( "tap" )
            $('.commstar .star5').trigger( "click" )
        }
        if ( $(".f-goods").length > 0 ) {
            $('.fop-main .star5').trigger( "tap" )
            $('.fop-main .star5').trigger( "click" )
            $('.f-item .f-textarea textarea').val('感觉不错，价格也很公道，值的购买！')
        };
        setTimeout( function(){
            $('.btn-submit').trigger( "tap" )
            $('.btn-submit').trigger( "click" )
        }, 500)
    };

    // 价格保护
    if ( $( "#productscroll ").length > 0 && $("#jb-product").text() == "价保申请") {
        $('body').append('<div class="weui-mask weui-mask--visible"><h1>已经开始自动检查价格变化，您可以关闭窗口了</h1><span class="close">x</span></div>')
        $('span.close').on('click', () => {
            $('.weui-mask').remove()
    })
        if ( $( "#productscroll #datas").length > 0) {
            chrome.runtime.sendMessage({
                text: "isLogin",
            }, function(response) {
                console.log("Response: ", response);
            });
            console.log('成功获取价格保护商品列表', new Date())
            getAllOrders()
        } else {
            console.log('好尴尬，最近没有买东西..', new Date())
        }
    };
}

// 上次运行检查的时间已经过去一天了
$( document ).ready(function() {
    console.log('京价宝注入页面成功');
    setTimeout( function(){
        CheckDom()
    }, 3000)
});