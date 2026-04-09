const MINIAPP_BASE_URL = 'https://cxyy.top'
const MINIAPP_SHELL_ID = 'drama_dynamic_v1'

function buildAssetUrl(path) {
  return `${MINIAPP_BASE_URL}${path}`
}

function buildBootstrapData(appId) {
  return {
    mode: 'B',
    shell_id: MINIAPP_SHELL_ID,
    app_id: appId,
    theme: {
      brand_name: '星幕剧场',
      nav_title: '星幕剧场',
      primary_color: '#2e6cf6',
      secondary_color: '#8ec5ff',
      page_bg_color: '#f6f8ff',
      card_bg_color: '#ffffff',
      text_primary: '#1f2430',
      text_secondary: '#6f7b8c',
    },
    assets: {
      default_empty_icon: buildAssetUrl('/subapps/splay/assets/empty.png'),
      default_avatar: buildAssetUrl('/subapps/splay/assets/s_def_avatar.png'),
      common_arrow_icon: buildAssetUrl('/subapps/splay/assets/s_menu.png'),
      common_close_icon: buildAssetUrl('/subapps/splay/assets/s_close.png'),
    },
    tab_bar: {
      type: 'custom',
      default_page_key: 'theater',
      items: [
        {
          key: 'follow',
          text: '追剧',
          icon: buildAssetUrl('/subapps/splay/static/tabs/zhuiju.png'),
          active_icon: buildAssetUrl('/subapps/splay/static/tabs/zhuiju-active.png'),
          page_key: 'follow',
        },
        {
          key: 'theater',
          text: '剧场',
          icon: buildAssetUrl('/subapps/splay/static/tabs/juchang.png'),
          active_icon: buildAssetUrl('/subapps/splay/static/tabs/juchang-active.png'),
          page_key: 'theater',
        },
        {
          key: 'mine',
          text: '我的',
          icon: buildAssetUrl('/subapps/splay/static/tabs/wode.png'),
          active_icon: buildAssetUrl('/subapps/splay/static/tabs/wode-active.png'),
          page_key: 'mine',
        },
      ],
    },
    fallback: {
      when_layout_empty: 'weather_placeholder',
      when_page_empty: 'page_placeholder',
    },
    features: {
      enable_webview: true,
      enable_payment: true,
      enable_recharge_record: true,
      enable_consume_record: true,
    },
  }
}

function buildLayoutData(appId) {
  return {
    app_id: appId,
    pages: {
      theater: {
        page_key: 'theater',
        page_title: '剧场',
        nav_mode: 'custom',
        background: {
          type: 'color',
          value: '#f6f8ff',
        },
        nav_bar: {
          logo: buildAssetUrl('/subapps/splay/assets/juchang_text.png'),
        },
        sections: [
          {
            type: 'switch_tabs',
            key: 'theater_tabs',
            data_source: 'static',
            items: [
              { key: 'featured', text: '精彩剧场' },
              { key: 'year', text: '年度好剧' },
            ],
          },
          {
            type: 'banner_swiper',
            key: 'banner',
            data_source: 'remote',
            api_key: 'banner_list',
            style: {
              margin_top: 12,
              margin_bottom: 20,
              padding_x: 16,
              border_radius: 20,
            },
            item_schema: {
              image: 'cover',
              action_type: 'banner_link',
            },
          },
          {
            type: 'hot_swiper',
            key: 'hot',
            title_icon: buildAssetUrl('/subapps/splay/assets/title_icon.png'),
            data_source: 'remote',
            api_key: 'hot_list',
            style: {
              margin_bottom: 20,
              padding_x: 16,
            },
            group_schema: {
              title: 'title',
              list: 'list',
            },
            item_schema: {
              cover: 'cover',
              title: 'title',
              sub_title: 'update_text',
              action_text: '看剧',
              id_field: 'id',
            },
          },
          {
            type: 'grid_list',
            key: 'selected_list',
            title: '精选好剧',
            title_icon: buildAssetUrl('/subapps/splay/assets/title_icon.png'),
            data_source: 'remote',
            api_key: 'all_list',
            style: {
              margin_bottom: 20,
              padding_x: 16,
              columns: 3,
              aspect_ratio: '3:4',
            },
            item_schema: {
              cover: 'cover',
              title: 'title',
              sub_title: 'update_text',
              id_field: 'id',
            },
          },
          {
            type: 'grid_list',
            key: 'year_list',
            title: '年度好剧',
            title_icon: buildAssetUrl('/subapps/splay/assets/title_icon.png'),
            data_source: 'remote',
            api_key: 'h5_feed_list',
            style: {
              margin_bottom: 20,
              padding_x: 16,
              columns: 3,
              aspect_ratio: '3:4',
            },
            item_schema: {
              cover: 'cover',
              title: 'title',
              sub_title: 'update_text',
              id_field: 'id',
            },
            action: {
              type: 'open_webview_album',
              params: {
                id_field: 'id',
              },
            },
          },
        ],
        floating: {
          resume_card: {
            enabled: true,
            eyebrow_text: '继续观看',
            default_title: '继续观看',
            progress_prefix: '观看至：',
            update_prefix: '更新至：',
            fallback_progress_text: '继续进入播放器观看',
            play_icon: buildAssetUrl('/subapps/splay/assets/revenue_play_btn.png'),
          },
        },
        dialogs: {
          revenue_dialog: {
            bg_image: buildAssetUrl('/subapps/splay/assets/revenue_bg.png'),
            close_icon: buildAssetUrl('/subapps/splay/assets/free_dialog/close_icon.png'),
            enter_button_image: buildAssetUrl('/subapps/splay/assets/revenue_enter_btn.png'),
            play_button_image: buildAssetUrl('/subapps/splay/assets/revenue_play_btn.png'),
          },
        },
      },
      follow: {
        page_key: 'follow',
        page_title: '追剧',
        nav_mode: 'custom',
        background: {
          type: 'color',
          value: '#f8fbff',
        },
        nav_bar: {
          items: [
            {
              key: 'history',
              text: '看过',
              active_text_image: buildAssetUrl('/subapps/splay/assets/kanguo_text.png'),
            },
            {
              key: 'follow',
              text: '追剧',
              active_text_image: buildAssetUrl('/subapps/splay/assets/zhuiju_text.png'),
            },
          ],
        },
        empty_state: {
          icon: buildAssetUrl('/subapps/splay/assets/empty.png'),
          title: '这里空空如也',
          description: '快去剧场看看吧',
          action_text: '去剧场看看',
          action: {
            type: 'switch_tab',
            params: {
              page_key: 'theater',
            },
          },
        },
        list_config: {
          follow_count_prefix: '已追 ',
          follow_count_suffix: ' 个',
          finished_text: '完结',
          updating_text: '更新中',
          default_progress_text: '未观看',
          history_action_text: '继续看',
          follow_action_text: '继续追',
          progress_icon: buildAssetUrl('/subapps/splay/assets/s_pay.png'),
        },
        data_sources: {
          history: {
            api_key: 'history_list',
          },
          follow: {
            api_key: 'collection_list',
          },
        },
      },
      mine: {
        page_key: 'mine',
        page_title: '我的',
        nav_mode: 'custom',
        background: {
          type: 'color',
          value: '#f5f8ff',
        },
        header: {
          bg_image: buildAssetUrl('/subapps/splay/assets/back.png'),
          default_avatar: buildAssetUrl('/subapps/splay/assets/s_def_avatar.png'),
          default_nickname: '用户昵称',
          user_id_prefix: '用户ID：',
        },
        account_cards: [
          {
            key: 'balance',
            icon: buildAssetUrl('/subapps/splay/assets/s_account.png'),
            label: '账户余额',
            action_text: '去充值',
            action_icon: buildAssetUrl('/subapps/splay/assets/s_go_pay.png'),
            action: {
              type: 'open_payment_popup',
            },
          },
          {
            key: 'vip',
            icon: buildAssetUrl('/subapps/splay/assets/s_vip.png'),
            label: '会员有效期(天)',
          },
        ],
        menus: [
          {
            key: 'recharge',
            name: '充值记录',
            icon: buildAssetUrl('/subapps/splay/assets/s_icon_pay.png'),
            action: {
              type: 'navigate_page',
              params: {
                page_key: 'recharge_record',
              },
            },
          },
          {
            key: 'consume',
            name: '消费记录',
            icon: buildAssetUrl('/subapps/splay/assets/s_icon_consume_new.png'),
            action: {
              type: 'navigate_page',
              params: {
                page_key: 'consume_record',
              },
            },
          },
          {
            key: 'customer',
            name: '联系客服',
            icon: buildAssetUrl('/subapps/splay/assets/s_icon_customer.png'),
            sub_text: '在线时间：10:00-20:00',
            action: {
              type: 'contact',
            },
          },
          {
            key: 'favorite',
            name: '收藏小程序',
            icon: buildAssetUrl('/subapps/splay/assets/s_icon_collection.png'),
            action: {
              type: 'favorite_tip',
            },
          },
        ],
      },
    },
    aux_pages: {
      recharge_record: {
        title: '充值记录',
        empty_description: '暂无充值记录',
        customer_text: '客服',
        customer_icon: buildAssetUrl('/subapps/splay/assets/s_icon_customer.png'),
      },
      consume_record: {
        title: '消费记录',
        empty_description: '暂无消费记录',
        customer_text: '客服',
        customer_icon: buildAssetUrl('/subapps/splay/assets/s_icon_customer.png'),
      },
      feedback: {
        title: '反馈与投诉',
        header_icon: buildAssetUrl('/subapps/splay/assets/icon_bang.png'),
        header_text: '您的建议，是我们改进的动力！',
        type_title: '投诉类型',
        desc_title: '补充描述',
        placeholder: '请填写问题描述，以便我们提供更好的帮助(请不要少于4个字哦)',
        submit_text: '立即反馈',
        type_options: [
          { value: 'lag', label: '播放卡顿/不流畅' },
          { value: 'black', label: '无法播放/黑屏' },
          { value: 'content', label: '内容低俗' },
          { value: 'function', label: '功能异常' },
          { value: 'charge', label: '充值异常' },
          { value: 'other', label: '其他' },
        ],
      },
      payment_popup: {
        default_title: '短剧创作不易，感谢您的支持！',
        empty_package_text: '暂无可购买套餐',
        mine_balance_text: '当前余额 {balance} K币。请选择需要充值的内容！',
        unlock_need_text: '解锁本集需：{needCoin} k币',
        current_balance_text: '当前余额：{balance} k币',
        fee_notice_entry_text: '支付前请阅读《付费须知》',
        contact_prefix_text: '如有问题请',
        contact_text: '联系客服',
        close_icon: buildAssetUrl('/subapps/splay/assets/s_close.png'),
        gesture_icon: buildAssetUrl('/subapps/splay/assets/pay_dialog/isGesture.png'),
        customer_icon: buildAssetUrl('/subapps/splay/assets/s_icon_customer.png'),
        themes: {
          gold: {
            popup_bg: buildAssetUrl('/subapps/splay/assets/pay_dialog/theme_gold/gold-bg.png'),
            normal_card_bg: buildAssetUrl('/subapps/splay/assets/pay_dialog/theme_gold/gold-normal.png'),
            highlight_card_bg: buildAssetUrl(
              '/subapps/splay/assets/pay_dialog/theme_gold/gold-highlight.png'
            ),
          },
          pink: {
            popup_bg: buildAssetUrl('/subapps/splay/assets/pay_dialog/theme_pink/theme-pink-bg.png'),
            normal_card_bg: buildAssetUrl(
              '/subapps/splay/assets/pay_dialog/theme_pink/normal-sku-bg.png'
            ),
            highlight_card_bg: buildAssetUrl(
              '/subapps/splay/assets/pay_dialog/theme_pink/highlight-sku-bg.png'
            ),
            header_icon: buildAssetUrl('/subapps/splay/assets/pay_dialog/theme_pink/header-icon.png'),
          },
        },
        fee_notice: {
          title: '付费须知',
          confirm_text: '我已知晓',
          items: [
            '1. K币、会员及剧卡属于虚拟商品，1元兑换100K币，剧卡用于解锁整部剧，一经购买不得退换；',
            '2. 充值后到账可能有延迟，2小时内未到账请联系客服；',
            '3. 未成年人应在监护人指导下进行付费操作。',
            '4. 客服工作时间：10:00~22:00',
          ],
        },
      },
      webview: {
        title: '短剧播放',
      },
      pay_loading: {
        title: '支付中',
        loading_text: '加载中...',
      },
    },
    global_texts: {
      loading: '加载中...',
      loadmore: '加载更多',
      nomore: '- 已经到底了 -',
    },
    global_assets: {
      title_icon: buildAssetUrl('/subapps/splay/assets/title_icon.png'),
      empty_icon: buildAssetUrl('/subapps/splay/assets/empty.png'),
    },
  }
}

export { MINIAPP_SHELL_ID, MINIAPP_BASE_URL, buildBootstrapData, buildLayoutData }
