'use strict';

if (typeof goog !== 'undefined') {
    goog.provide('Blockly.JavaScript.Sendto');
    goog.require('Blockly.JavaScript');
}

Blockly.Translate =
    Blockly.Translate ||
    function (word, lang) {
        lang = lang || systemLang;
        if (Blockly.Words && Blockly.Words[word]) {
            return Blockly.Words[word][lang] || Blockly.Words[word].en;
        } else {
            return word;
        }
    };

/// --- SendTo Awtrix Light --------------------------------------------------
Blockly.Words['awtrix-ng_notification'] = {
    en: 'Awtrix-ng notification',
    de: 'Awtrix-ng Benachrichtigung',
    ru: 'Awtrix-ng уведомление',
    pt: 'Awtrix-ng Notificação',
    nl: 'Awtrix-ng Vertaling',
    fr: 'Awtrix-ng Notification',
    it: 'Awtrix-ng Notifica',
    es: 'Awtrix-ng Alerta',
    pl: 'Awtrix-ng notification',
    uk: 'Awtrix-ng повідомлення',
    'zh-cn': 'Awtrix-ng 发出通知',
};
Blockly.Words['awtrix-ng_playsound'] = {
    en: 'Awtrix-ng Play sound',
    de: 'Awtrix-ng Sound spielen',
    ru: 'Awtrix-ng Играть звук',
    pt: 'Awtrix-ng Tocar som',
    nl: 'Awtrix-ng Speel',
    fr: 'Awtrix-ng Play sound',
    it: 'Awtrix-ng Suoni suono',
    es: 'Awtrix-ng Jugar sonido',
    pl: 'Awtrix-ng Dźwięk',
    uk: 'Awtrix-ng Грати звук',
    'zh-cn': 'Awtrix-ng 声音',
};
Blockly.Words['awtrix-ng_message'] = {
    en: 'Message',
    de: 'Nachricht',
    ru: 'Сообщение',
    pt: 'Mensagem',
    nl: 'Bericht',
    fr: 'Message',
    it: 'Messaggio',
    es: 'Mensaje',
    pl: 'Message',
    uk: 'Новини',
    'zh-cn': '导 言',
};
Blockly.Words['awtrix-ng_color'] = {
    en: 'Color',
    de: 'Farbe',
    ru: 'Цвет',
    pt: 'Cor',
    nl: 'Color',
    fr: 'Couleur',
    it: 'Colore',
    es: 'Color',
    pl: 'Color',
    uk: 'Колір',
    'zh-cn': '科 法 律',
};
Blockly.Words['awtrix-ng_sound'] = {
    en: 'Sound',
    de: 'Ton',
    ru: 'Звук',
    pt: 'Soa',
    nl: 'Sound',
    fr: 'Sound',
    it: 'Suono',
    es: 'Sonido',
    pl: 'Sound',
    uk: 'Звуковий',
    'zh-cn': '保密',
};
Blockly.Words['awtrix-ng_icon'] = {
    en: 'Icon',
    de: 'Icon',
    ru: 'Икона',
    pt: 'Ícone',
    nl: 'Icon',
    fr: 'Icon',
    it: 'Icona',
    es: 'Icon',
    pl: 'Ikon',
    uk: 'Ікона',
    'zh-cn': '一. 导言',
};
Blockly.Words['awtrix-ng_repeat'] = {
    en: 'Repetitions',
    de: 'Wiederholungen',
    ru: 'Повторение',
    pt: 'Repetições',
    nl: 'Herhaling',
    fr: 'Répétitions',
    it: 'Ripetizioni',
    es: 'Repeticiones',
    pl: 'Repetycja',
    uk: 'Рекорди',
    'zh-cn': '重复',
};
Blockly.Words['awtrix-ng_duration'] = {
    en: 'Duration',
    de: 'Dauer',
    ru: 'Продолжительность',
    pt: 'Duração',
    nl: 'Vertaling:',
    fr: 'Durée',
    it: 'Durata',
    es: 'Duración',
    pl: 'Duracja',
    uk: 'Тривалість',
    'zh-cn': '期间',
};
Blockly.Words['awtrix-ng_rainbow'] = {
    en: 'Rainbow text',
    de: 'Regenbogentext',
    ru: 'Текст радуга',
    pt: 'Texto do arco-íris',
    nl: 'Vertaling:',
    fr: 'Texte arc-en-ciel',
    it: `Testo dell'arcobaleno`,
    es: 'Texto del arco iris',
    pl: 'Rainbow text',
    uk: 'Веселий текст',
    'zh-cn': '文 件',
};
Blockly.Words['awtrix-ng_stack'] = {
    en: 'Stack',
    de: 'Stapeln',
    ru: 'Стек',
    pt: 'Stack',
    nl: 'Stack',
    fr: 'Stack',
    it: 'Stack',
    es: 'Stack',
    pl: 'Stack',
    uk: 'Стейк',
    'zh-cn': '包装',
};
Blockly.Words['awtrix-ng_wakeup'] = {
    en: 'Wakeup',
    de: 'Aufwecken',
    ru: 'Вакеп',
    pt: 'Acorda',
    nl: 'Wakker worden',
    fr: 'Réveille-toi',
    it: 'Sveglia',
    es: 'Despierta',
    pl: 'Wakeup',
    uk: 'Вейкап',
    'zh-cn': '瓦克鲁',
};
Blockly.Words['awtrix-ng_hold'] = {
    en: 'Hold',
    de: 'Halten',
    ru: 'Стойте',
    pt: 'Espere',
    nl: 'Wacht',
    fr: 'Attendez',
    it: 'Aspetta',
    es: 'Espera',
    pl: 'Trzymaj',
    uk: 'Прованс',
    'zh-cn': '坚持住',
};
Blockly.Words['awtrix-ng_anyInstance'] = {
    en: 'All instances',
    de: 'Alle Instanzen',
    ru: 'Все экземпляры',
    pt: 'Todas as instâncias',
    nl: 'Alle instanties',
    fr: 'Toutes les instances',
    it: 'Tutte le istanze',
    es: 'Todas las instancias',
    pl: 'Wszystkie instancje',
    uk: 'Всі екземпляри',
    'zh-cn': '所有案件',
};
Blockly.Words['awtrix-ng_tooltip'] = {
    en: 'Send notification to Awtrix',
    de: 'Nachricht senden an Awtrix',
    ru: 'Отправить уведомление в Awtrix',
    pt: 'Enviar notificação para Awtrix',
    nl: 'Stuur een bericht naar Awtrix',
    fr: 'Envoyer la notification à Awtrix',
    it: 'Invia notifica a Awtrix',
    es: 'Enviar notificación a Awtrix',
    pl: 'Powiadomienie Awtrix',
    uk: 'Надіслати повідомлення на Awtrix',
    'zh-cn': '向Awtrix发出通知',
};
Blockly.Words['awtrix-ng_help'] = { en: 'https://github.com/klein0r/ioBroker.awtrix-ng/blob/master/docs/en/README.md', de: 'https://github.com/klein0r/ioBroker.awtrix-ng/blob/master/docs/de/README.md' };

Blockly.Sendto.blocks['awtrix-ng'] =
    '<block type="awtrix-ng">' +
    '  <field name="INSTANCE"></field>' +
    '  <field name="RAINBOW">FALSE</field>' +
    '  <field name="STACK">TRUE</field>' +
    '  <field name="WAKEUP">TRUE</field>' +
    '  <field name="HOLD">FALSE</field>' +
    '  <value name="MESSAGE">' +
    '    <shadow type="text">' +
    '      <field name="TEXT">haus-automatisierung.com</field>' +
    '    </shadow>' +
    '  </value>' +
    '  <value name="COLOR">' +
    '    <shadow type="colour_picker">' +
    '      <field name="COLOUR">#ffffff</field>' +
    '    </shadow>' +
    '  </value>' +
    '  <value name="SOUND">' +
    '    <shadow type="logic_null"></shadow>' +
    '  </value>' +
    '  <value name="ICON">' +
    '    <shadow type="logic_null"></shadow>' +
    '  </value>' +
    '  <value name="REPEAT">' +
    '    <shadow type="math_number">' +
    '      <field name="NUM">1</field>' +
    '    </shadow>' +
    '  </value>' +
    '  <value name="DURATION">' +
    '    <shadow type="math_number">' +
    '      <field name="NUM">0</field>' +
    '    </shadow>' +
    '  </value>' +
    '</block>';

Blockly.Blocks['awtrix-ng'] = {
    init: function () {
        const options = [];

        if (typeof main !== 'undefined' && main.instances) {
            for (let i = 0; i < main.instances.length; i++) {
                const m = main.instances[i].match(/^system.adapter.awtrix-ng.(\d+)$/);
                if (m) {
                    const n = parseInt(m[1], 10);
                    options.push(['awtrix-ng.' + n, '.' + n]);
                }
            }
        }

        if (!options.length) {
            for (let k = 0; k <= 4; k++) {
                options.push(['awtrix-ng.' + k, '.' + k]);
            }
        }

        options.unshift([Blockly.Translate('awtrix-ng_anyInstance'), '']);

        this.appendDummyInput('INSTANCE').appendField(Blockly.Translate('awtrix-ng_notification')).appendField(new Blockly.FieldDropdown(options), 'INSTANCE');
        this.appendValueInput('MESSAGE').appendField(Blockly.Translate('awtrix-ng_message'));
        this.appendValueInput('COLOR').appendField(Blockly.Translate('awtrix-ng_color'));
        this.appendValueInput('SOUND').appendField(Blockly.Translate('awtrix-ng_sound'));
        this.appendValueInput('ICON').appendField(Blockly.Translate('awtrix-ng_icon'));
        this.appendValueInput('REPEAT').appendField(Blockly.Translate('awtrix-ng_repeat'));
        this.appendValueInput('DURATION').appendField(Blockly.Translate('awtrix-ng_duration'));
        this.appendDummyInput('RAINBOW').appendField(Blockly.Translate('awtrix-ng_rainbow')).appendField(new Blockly.FieldCheckbox('FALSE'), 'RAINBOW');
        this.appendDummyInput('STACK_INPUT').appendField(Blockly.Translate('awtrix-ng_stack')).appendField(new Blockly.FieldCheckbox('TRUE'), 'STACK');
        this.appendDummyInput('WAKEUP_INPUT').appendField(Blockly.Translate('awtrix-ng_wakeup')).appendField(new Blockly.FieldCheckbox('TRUE'), 'WAKEUP');
        this.appendDummyInput('HOLD_INPUT').appendField(Blockly.Translate('awtrix-ng_hold')).appendField(new Blockly.FieldCheckbox('FALSE'), 'HOLD');

        this.setInputsInline(false);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);

        this.setColour(Blockly.Sendto.HUE);
        this.setTooltip(Blockly.Translate('awtrix-ng_tooltip'));
        this.setHelpUrl(Blockly.Translate('awtrix-ng_help'));
    },
};

Blockly.JavaScript['awtrix-ng'] = function (block) {
    const message = Blockly.JavaScript.valueToCode(block, 'MESSAGE', Blockly.JavaScript.ORDER_ATOMIC);
    const color = Blockly.JavaScript.valueToCode(block, 'COLOR', Blockly.JavaScript.ORDER_ATOMIC);
    const sound = Blockly.JavaScript.valueToCode(block, 'SOUND', Blockly.JavaScript.ORDER_ATOMIC);
    const icon = Blockly.JavaScript.valueToCode(block, 'ICON', Blockly.JavaScript.ORDER_ATOMIC);
    const repeat = Blockly.JavaScript.valueToCode(block, 'REPEAT', Blockly.JavaScript.ORDER_ATOMIC);
    const duration = Blockly.JavaScript.valueToCode(block, 'DURATION', Blockly.JavaScript.ORDER_ATOMIC);

    let rainbow = block.getFieldValue('RAINBOW');
    rainbow = rainbow === 'TRUE' || rainbow === 'true' || rainbow === true;

    let stack = block.getFieldValue('STACK');
    stack = stack === 'TRUE' || stack === 'true' || stack === true;

    let wakeup = block.getFieldValue('WAKEUP');
    wakeup = wakeup === 'TRUE' || wakeup === 'true' || wakeup === true;

    let hold = block.getFieldValue('HOLD');
    hold = hold === 'TRUE' || hold === 'true' || hold === true;

    const objText = [];
    message && objText.push('text: ' + message);
    color && !rainbow && objText.push('color: String(' + color + ').toUpperCase()');
    sound && objText.push('sound: ' + sound);
    icon && objText.push('icon: ' + icon);
    repeat && objText.push('repeat: parseInt(' + repeat + ')');
    duration && objText.push('duration: parseInt(' + duration + ')');
    objText.push('rainbow: ' + rainbow);
    objText.push('stack: ' + stack);
    objText.push('wakeup: ' + wakeup);
    objText.push('hold: ' + hold);

    return `sendTo('awtrix-ng${block.getFieldValue('INSTANCE')}', 'notification', { ${objText.join(', ')} });`;
};

Blockly.Sendto.blocks['awtrix-ng_playsound'] =
    '<block type="awtrix-ng_playsound">' +
    '  <field name="INSTANCE"></field>' +
    '  <value name="SOUND">' +
    '    <shadow type="text">' +
    '      <field name="TEXT">...</field>' +
    '    </shadow>' +
    '  </value>' +
    '</block>';

Blockly.Blocks['awtrix-ng_playsound'] = {
    init: function () {
        const options = [];

        if (typeof main !== 'undefined' && main.instances) {
            for (let i = 0; i < main.instances.length; i++) {
                const m = main.instances[i].match(/^system.adapter.awtrix-ng.(\d+)$/);
                if (m) {
                    const n = parseInt(m[1], 10);
                    options.push(['awtrix-ng.' + n, '.' + n]);
                }
            }
        }

        if (!options.length) {
            for (let k = 0; k <= 4; k++) {
                options.push(['awtrix-ng.' + k, '.' + k]);
            }
        }

        options.unshift([Blockly.Translate('awtrix-ng_anyInstance'), '']);

        this.appendDummyInput('INSTANCE').appendField(Blockly.Translate('awtrix-ng_playsound')).appendField(new Blockly.FieldDropdown(options), 'INSTANCE');
        this.appendValueInput('SOUND').appendField(Blockly.Translate('awtrix-ng_sound'));

        this.setInputsInline(false);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);

        this.setColour(Blockly.Sendto.HUE);
        this.setTooltip(Blockly.Translate('awtrix-ng_tooltip'));
        this.setHelpUrl(Blockly.Translate('awtrix-ng_help'));
    },
};

Blockly.JavaScript['awtrix-ng_playsound'] = function (block) {
    const sound = Blockly.JavaScript.valueToCode(block, 'SOUND', Blockly.JavaScript.ORDER_ATOMIC);

    const objText = [];
    sound && objText.push('sound: ' + sound);

    return `sendTo('awtrix-ng${block.getFieldValue('INSTANCE')}', 'sound', { ${objText.join(', ')} });`;
};
