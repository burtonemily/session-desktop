/* global Whisper $ */

// eslint-disable-next-line func-names
(function() {
    'use strict';
  
    window.Whisper = window.Whisper || {};
  
    Whisper.SessionConversationView = Whisper.View.extend({
      initialize(options) {
        this.props = {
            el: $('body'),
            ...options,
        };
      },
  
      render() {
        this.conversationView = new Whisper.SessionConversationView({
          className: 'session-conversation-wrapper',
          Component: window.Signal.Components.SessionConversation,
          props: this.props,
        });
  
        this.$el.prepend(this.conversationView.el);
      },
    });
  })();
  