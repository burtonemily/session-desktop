import React from 'react';
import classNames from 'classnames';

import { Avatar } from '../Avatar';
import { Spinner } from '../Spinner';
import { MessageBody } from './MessageBody';
import { ExpireTimer } from './ExpireTimer';
import { ImageGrid } from './ImageGrid';
import { Image } from './Image';
import { Timestamp } from './Timestamp';
import { ContactName } from './ContactName';
import { Quote, QuotedAttachmentType } from './Quote';
import { EmbeddedContact } from './EmbeddedContact';

// Audio Player
import H5AudioPlayer from 'react-h5-audio-player';
// import 'react-h5-audio-player/lib/styles.css';

import {
  canDisplayImage,
  getExtensionForDisplay,
  getGridDimensions,
  getImageDimensions,
  hasImage,
  hasVideoScreenshot,
  isAudio,
  isImage,
  isImageAttachment,
  isVideo,
} from '../../../ts/types/Attachment';
import { AttachmentType } from '../../types/Attachment';
import { Contact } from '../../types/Contact';

import { getIncrement } from '../../util/timer';
import { isFileDangerous } from '../../util/isFileDangerous';
import { ColorType, LocalizerType } from '../../types/Util';
import { ContextMenu, ContextMenuTrigger, MenuItem } from 'react-contextmenu';
import { SessionIcon, SessionIconSize, SessionIconType } from '../session/icon';
import { ReplyingToMessageProps } from '../session/conversation/SessionCompositionBox';
import _ from 'lodash';
import { MessageModel } from '../../../js/models/messages';

declare global {
  interface Window {
    shortenPubkey: any;
    contextMenuShown: boolean;
  }
}

interface Trigger {
  handleContextClick: (event: React.MouseEvent<HTMLDivElement>) => void;
}

// Same as MIN_WIDTH in ImageGrid.tsx
const MINIMUM_LINK_PREVIEW_IMAGE_WIDTH = 200;

interface LinkPreviewType {
  title: string;
  domain: string;
  url: string;
  image?: AttachmentType;
}

export interface Props {
  disableMenu?: boolean;
  senderIsModerator?: boolean;
  isDeletable: boolean;
  isModerator?: boolean;
  text?: string;
  textPending?: boolean;
  id: string;
  collapseMetadata?: boolean;
  direction: 'incoming' | 'outgoing';
  timestamp: number;
  serverTimestamp?: number;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'error';
  // What if changed this over to a single contact like quote, and put the events on it?
  contact?: Contact & {
    hasSignalAccount: boolean;
    onSendMessage?: () => void;
    onClick?: () => void;
  };
  authorName?: string;
  authorProfileName?: string;
  /** Note: this should be formatted for display */
  authorPhoneNumber: string;
  conversationType: 'group' | 'direct';
  attachments?: Array<AttachmentType>;
  quote?: {
    text: string;
    attachment?: QuotedAttachmentType;
    isFromMe: boolean;
    authorPhoneNumber: string;
    authorProfileName?: string;
    authorName?: string;
    onClick?: () => void;
    referencedMessageNotFound: boolean;
  };
  previews: Array<LinkPreviewType>;
  authorAvatarPath?: string;
  isExpired: boolean;
  expirationLength?: number;
  expirationTimestamp?: number;
  convoId: string;
  isPublic?: boolean;
  isRss?: boolean;
  selected: boolean;
  isKickedFromGroup: boolean;
  // whether or not to show check boxes
  multiSelectMode: boolean;

  onClickAttachment?: (attachment: AttachmentType) => void;
  onClickLinkPreview?: (url: string) => void;
  onCopyText?: () => void;
  onSelectMessage: (messageId: string) => void;
  onReply?: (messagId: number) => void;
  onRetrySend?: () => void;
  onDownload?: (isDangerous: boolean) => void;
  onDelete?: () => void;
  onCopyPubKey?: () => void;
  onBanUser?: () => void;
  onShowDetail: () => void;
  onShowUserDetails: (userPubKey: string) => void;
}

interface State {
  expiring: boolean;
  expired: boolean;
  imageBroken: boolean;
}

const EXPIRATION_CHECK_MINIMUM = 2000;
const EXPIRED_DELAY = 600;

export class Message extends React.PureComponent<Props, State> {
  public captureMenuTriggerBound: (trigger: any) => void;
  public showMenuBound: (event: React.MouseEvent<HTMLDivElement>) => void;
  public handleImageErrorBound: () => void;

  public menuTriggerRef: Trigger | undefined;
  public expirationCheckInterval: any;
  public expiredTimeout: any;

  public constructor(props: Props) {
    super(props);

    this.captureMenuTriggerBound = this.captureMenuTrigger.bind(this);
    this.showMenuBound = this.showMenu.bind(this);
    this.handleImageErrorBound = this.handleImageError.bind(this);
    this.onReplyPrivate = this.onReplyPrivate.bind(this);

    this.state = {
      expiring: false,
      expired: false,
      imageBroken: false,
    };
  }

  public componentDidMount() {
    const { expirationLength } = this.props;
    if (!expirationLength) {
      return;
    }

    const increment = getIncrement(expirationLength);
    const checkFrequency = Math.max(EXPIRATION_CHECK_MINIMUM, increment);

    this.checkExpired();

    this.expirationCheckInterval = setInterval(() => {
      this.checkExpired();
    }, checkFrequency);
  }

  public componentWillUnmount() {
    if (this.expirationCheckInterval) {
      clearInterval(this.expirationCheckInterval);
    }
    if (this.expiredTimeout) {
      clearTimeout(this.expiredTimeout);
    }
  }

  public componentDidUpdate() {
    this.checkExpired();
  }

  public checkExpired() {
    const now = Date.now();
    const { isExpired, expirationTimestamp, expirationLength } = this.props;

    if (!expirationTimestamp || !expirationLength) {
      return;
    }
    if (this.expiredTimeout) {
      return;
    }

    if (isExpired || now >= expirationTimestamp) {
      this.setState({
        expiring: true,
      });

      const setExpired = () => {
        this.setState({
          expired: true,
        });
      };
      this.expiredTimeout = setTimeout(setExpired, EXPIRED_DELAY);
    }
  }

  public handleImageError() {
    this.setState({
      imageBroken: true,
    });
  }

  public renderMetadataBadges() {
    const { direction, isPublic, senderIsModerator, id } = this.props;

    const badges = [isPublic && 'Public', senderIsModerator && 'Mod'];

    return badges
      .map(badgeText => {
        if (typeof badgeText !== 'string') {
          return null;
        }

        return (
          <div key={`${id}-${badgeText}`}>
            <span className="module-message__metadata__badge--separator">
              &nbsp;•&nbsp;
            </span>
            <span
              className={classNames(
                'module-message__metadata__badge',
                `module-message__metadata__badge--${direction}`,
                `module-message__metadata__badge--${badgeText.toLowerCase()}`,
                `module-message__metadata__badge--${badgeText.toLowerCase()}--${direction}`
              )}
              key={badgeText}
            >
              {badgeText}
            </span>
          </div>
        );
      })
      .filter(i => !!i);
  }

  public renderMetadata() {
    const {
      collapseMetadata,
      direction,
      expirationLength,
      expirationTimestamp,
      status,
      text,
      textPending,
      timestamp,
      serverTimestamp,
    } = this.props;

    if (collapseMetadata) {
      return null;
    }

    const isShowingImage = this.isShowingImage();
    const withImageNoCaption = Boolean(!text && isShowingImage);
    const showError = status === 'error' && direction === 'outgoing';
    const showSentNoErrors =
      !textPending &&
      direction === 'outgoing' &&
      status !== 'error' &&
      status !== 'sending';

    const showSending =
      !textPending && direction === 'outgoing' && status === 'sending';

    return (
      <div
        className={classNames(
          'module-message__metadata',
          withImageNoCaption
            ? 'module-message__metadata--with-image-no-caption'
            : null
        )}
      >
        {showError ? (
          <span
            className={classNames(
              'module-message__metadata__date',
              `module-message__metadata__date--${direction}`,
              withImageNoCaption
                ? 'module-message__metadata__date--with-image-no-caption'
                : null
            )}
          >
            {window.i18n('sendFailed')}
          </span>
        ) : (
          <Timestamp
            i18n={window.i18n}
            timestamp={serverTimestamp || timestamp}
            extended={true}
            direction={direction}
            withImageNoCaption={withImageNoCaption}
            module="module-message__metadata__date"
          />
        )}
        {this.renderMetadataBadges()}
        {expirationLength && expirationTimestamp ? (
          <ExpireTimer
            direction={direction}
            expirationLength={expirationLength}
            expirationTimestamp={expirationTimestamp}
            withImageNoCaption={withImageNoCaption}
          />
        ) : null}
        <span className="module-message__metadata__spacer" />
        {textPending ? (
          <div className="module-message__metadata__spinner-container">
            <Spinner size="mini" direction={direction} />
          </div>
        ) : null}
        <span className="module-message__metadata__spacer" />
        {showSending ? (
          <div
            className={classNames(
              'module-message-detail__contact__status-icon',
              `module-message-detail__contact__status-icon--${status}`
            )}
          />
        ) : null}
        {showSentNoErrors ? (
          <div className="message-read-receipt-container">
            <SessionIcon
              iconType={SessionIconType.Check}
              iconSize={SessionIconSize.Small}
            />
          </div>
        ) : null}
      </div>
    );
  }

  // tslint:disable-next-line max-func-body-length cyclomatic-complexity
  public renderAttachment() {
    const {
      attachments,
      text,
      collapseMetadata,
      conversationType,
      direction,
      quote,
      onClickAttachment,
    } = this.props;
    const { imageBroken } = this.state;

    if (!attachments || !attachments[0]) {
      return null;
    }
    const firstAttachment = attachments[0];

    // For attachments which aren't full-frame
    const withContentBelow = Boolean(text);
    const withContentAbove =
      Boolean(quote) ||
      (conversationType === 'group' && direction === 'incoming');
    const displayImage = canDisplayImage(attachments);

    if (
      displayImage &&
      !imageBroken &&
      ((isImage(attachments) && hasImage(attachments)) ||
        (isVideo(attachments) && hasVideoScreenshot(attachments)))
    ) {
      return (
        <div
          className={classNames(
            'module-message__attachment-container',
            withContentAbove
              ? 'module-message__attachment-container--with-content-above'
              : null,
            withContentBelow
              ? 'module-message__attachment-container--with-content-below'
              : null
          )}
        >
          <ImageGrid
            attachments={attachments}
            withContentAbove={withContentAbove}
            withContentBelow={withContentBelow}
            bottomOverlay={!collapseMetadata}
            i18n={window.i18n}
            onError={this.handleImageErrorBound}
            onClickAttachment={onClickAttachment}
          />
        </div>
      );
    } else if (!firstAttachment.pending && isAudio(attachments)) {
      return (
        <div
          role="main"
          onClick={(e: any) => {
            e.stopPropagation();
          }}
        >
          {/* <audio
            role="button"
            onClick={(e: any) => {
              e.stopPropagation();
            }}
            controls={true}
            className={classNames(
              'module-message__audio-attachment',
              withContentBelow
                ? 'module-message__audio-attachment--with-content-below'
                : null,
              withContentAbove
                ? 'module-message__audio-attachment--with-content-above'
                : null
            )}
            key={firstAttachment.url}
          >
            <source src={firstAttachment.url} />
          </audio> */}
          <H5AudioPlayer
            src={firstAttachment.url}
            layout="horizontal-reverse"
            showSkipControls={false}
            showJumpControls={false}
            showDownloadProgress={false}
            customIcons={{
              play: (
                <SessionIcon
                  iconType={SessionIconType.Play}
                  iconSize={SessionIconSize.Small}
                  iconColor="#868686"
                />
              ),
              pause: (
                <SessionIcon
                  iconType={SessionIconType.Pause}
                  iconSize={SessionIconSize.Small}
                  iconColor="#868686"
                />
              ),
            }}
          />
        </div>
      );
    } else {
      const { pending, fileName, fileSize, contentType } = firstAttachment;
      const extension = getExtensionForDisplay({ contentType, fileName });
      const isDangerous = isFileDangerous(fileName || '');

      return (
        <div
          className={classNames(
            'module-message__generic-attachment',
            withContentBelow
              ? 'module-message__generic-attachment--with-content-below'
              : null,
            withContentAbove
              ? 'module-message__generic-attachment--with-content-above'
              : null
          )}
        >
          {pending ? (
            <div className="module-message__generic-attachment__spinner-container">
              <Spinner size="small" direction={direction} />
            </div>
          ) : (
            <div className="module-message__generic-attachment__icon-container">
              <div className="module-message__generic-attachment__icon">
                {extension ? (
                  <div className="module-message__generic-attachment__icon__extension">
                    {extension}
                  </div>
                ) : null}
              </div>
              {isDangerous ? (
                <div className="module-message__generic-attachment__icon-dangerous-container">
                  <div className="module-message__generic-attachment__icon-dangerous" />
                </div>
              ) : null}
            </div>
          )}
          <div className="module-message__generic-attachment__text">
            <div
              className={classNames(
                'module-message__generic-attachment__file-name',
                `module-message__generic-attachment__file-name--${direction}`
              )}
            >
              {fileName}
            </div>
            <div
              className={classNames(
                'module-message__generic-attachment__file-size',
                `module-message__generic-attachment__file-size--${direction}`
              )}
            >
              {fileSize}
            </div>
          </div>
        </div>
      );
    }
  }

  // tslint:disable-next-line cyclomatic-complexity
  public renderPreview() {
    const {
      attachments,
      conversationType,
      direction,
      onClickLinkPreview,
      previews,
      quote,
    } = this.props;

    // Attachments take precedence over Link Previews
    if (attachments && attachments.length) {
      return null;
    }

    if (!previews || previews.length < 1) {
      return null;
    }

    const first = previews[0];
    if (!first) {
      return null;
    }

    const withContentAbove =
      Boolean(quote) ||
      (conversationType === 'group' && direction === 'incoming');

    const previewHasImage = first.image && isImageAttachment(first.image);
    const width = first.image && first.image.width;
    const isFullSizeImage = width && width >= MINIMUM_LINK_PREVIEW_IMAGE_WIDTH;

    return (
      <div
        role="button"
        className={classNames(
          'module-message__link-preview',
          withContentAbove
            ? 'module-message__link-preview--with-content-above'
            : null
        )}
        onClick={() => {
          if (onClickLinkPreview) {
            onClickLinkPreview(first.url);
          }
        }}
      >
        {first.image && previewHasImage && isFullSizeImage ? (
          <ImageGrid
            attachments={[first.image]}
            withContentAbove={withContentAbove}
            withContentBelow={true}
            onError={this.handleImageErrorBound}
            i18n={window.i18n}
          />
        ) : null}
        <div
          className={classNames(
            'module-message__link-preview__content',
            withContentAbove || isFullSizeImage
              ? 'module-message__link-preview__content--with-content-above'
              : null
          )}
        >
          {first.image && previewHasImage && !isFullSizeImage ? (
            <div className="module-message__link-preview__icon_container">
              <Image
                smallCurveTopLeft={!withContentAbove}
                softCorners={true}
                alt={window.i18n('previewThumbnail', [first.domain])}
                height={72}
                width={72}
                url={first.image.url}
                attachment={first.image}
                onError={this.handleImageErrorBound}
                i18n={window.i18n}
              />
            </div>
          ) : null}
          <div
            className={classNames(
              'module-message__link-preview__text',
              previewHasImage && !isFullSizeImage
                ? 'module-message__link-preview__text--with-icon'
                : null
            )}
          >
            <div className="module-message__link-preview__title">
              {first.title}
            </div>
            <div className="module-message__link-preview__location">
              {first.domain}
            </div>
          </div>
        </div>
      </div>
    );
  }

  public renderQuote() {
    const {
      conversationType,
      direction,
      quote,
      isPublic,
      convoId,
    } = this.props;

    if (!quote || !quote.authorPhoneNumber) {
      return null;
    }
    // console.warn('quote render ' , quote)

    const withContentAbove =
      conversationType === 'group' && direction === 'incoming';

    const shortenedPubkey = window.shortenPubkey(quote.authorPhoneNumber);

    const displayedPubkey = quote.authorProfileName
      ? shortenedPubkey
      : quote.authorPhoneNumber;

    return (
      <Quote
        i18n={window.i18n}
        onClick={quote.onClick}
        text={quote.text}
        attachment={quote.attachment}
        isIncoming={direction === 'incoming'}
        conversationType={conversationType}
        convoId={convoId}
        isPublic={isPublic}
        authorPhoneNumber={displayedPubkey}
        authorProfileName={quote.authorProfileName}
        authorName={quote.authorName}
        referencedMessageNotFound={quote.referencedMessageNotFound}
        isFromMe={quote.isFromMe}
        withContentAbove={withContentAbove}
      />
    );
  }

  public renderEmbeddedContact() {
    const {
      collapseMetadata,
      contact,
      conversationType,
      direction,
      text,
    } = this.props;
    if (!contact) {
      return null;
    }

    const withCaption = Boolean(text);
    const withContentAbove =
      conversationType === 'group' && direction === 'incoming';
    const withContentBelow = withCaption || !collapseMetadata;

    return (
      <EmbeddedContact
        contact={contact}
        hasSignalAccount={contact.hasSignalAccount}
        isIncoming={direction === 'incoming'}
        i18n={window.i18n}
        onClick={contact.onClick}
        withContentAbove={withContentAbove}
        withContentBelow={withContentBelow}
      />
    );
  }

  public renderAvatar() {
    const {
      authorAvatarPath,
      authorName,
      authorPhoneNumber,
      authorProfileName,
      collapseMetadata,
      senderIsModerator,
      conversationType,
      direction,
      onShowUserDetails,
    } = this.props;

    if (
      collapseMetadata ||
      conversationType !== 'group' ||
      direction === 'outgoing'
    ) {
      return;
    }
    const userName = authorName || authorProfileName || authorPhoneNumber;

    return (
      <div className="module-message__author-avatar">
        <Avatar
          avatarPath={authorAvatarPath}
          name={userName}
          size={36}
          onAvatarClick={() => {
            onShowUserDetails(authorPhoneNumber);
          }}
          pubkey={authorPhoneNumber}
        />
        {senderIsModerator && (
          <div className="module-avatar__icon--crown-wrapper">
            <div className="module-avatar__icon--crown" />
          </div>
        )}
      </div>
    );
  }

  public renderText() {
    const {
      text,
      textPending,
      direction,
      status,
      isRss,
      conversationType,
      convoId,
    } = this.props;

    const contents =
      direction === 'incoming' && status === 'error'
        ? window.i18n('incomingError')
        : text;

    if (!contents) {
      return null;
    }

    return (
      <div
        dir="auto"
        className={classNames(
          'module-message__text',
          `module-message__text--${direction}`,
          status === 'error' && direction === 'incoming'
            ? 'module-message__text--error'
            : null
        )}
      >
        <MessageBody
          text={contents || ''}
          isRss={isRss}
          i18n={window.i18n}
          textPending={textPending}
          isGroup={conversationType === 'group'}
          convoId={convoId}
        />
      </div>
    );
  }

  public renderError(isCorrectSide: boolean) {
    const { status, direction } = this.props;

    if (!isCorrectSide || status !== 'error') {
      return null;
    }

    return (
      <div className="module-message__error-container">
        <div
          className={classNames(
            'module-message__error',
            `module-message__error--${direction}`
          )}
        />
      </div>
    );
  }

  public captureMenuTrigger(triggerRef: Trigger) {
    this.menuTriggerRef = triggerRef;
  }
  public showMenu(event: React.MouseEvent<HTMLDivElement>) {
    if (this.menuTriggerRef) {
      this.menuTriggerRef.handleContextClick(event);
    }
  }

  public renderContextMenu(triggerId: string) {
    const {
      attachments,
      onCopyText,
      direction,
      status,
      isDeletable,
      onDelete,
      onDownload,
      onReply,
      onRetrySend,
      onShowDetail,
      isPublic,
      isModerator,
      onBanUser,
    } = this.props;

    const showRetry = status === 'error' && direction === 'outgoing';
    const fileName =
      attachments && attachments[0] ? attachments[0].fileName : null;
    const isDangerous = isFileDangerous(fileName || '');
    const multipleAttachments = attachments && attachments.length > 1;

    // Wraps a function to prevent event propagation, thus preventing
    // message selection whenever any of the menu buttons are pressed.
    const wrap = (f: any, ...args: Array<any>) => (event: Event) => {
      event.stopPropagation();
      if (f) {
        f(...args);
      }
    };

    const onContextMenuShown = () => {
      window.contextMenuShown = true;
    };

    const onContextMenuHidden = () => {
      // This function will called before the click event
      // on the message would trigger (and I was unable to
      // prevent propagation in this case), so use a short timeout
      setTimeout(() => {
        window.contextMenuShown = false;
      }, 100);
    };

    const isServerDeletable = !!this.props.isPublic;
    const deleteMessageCtxText = window.i18n(
      isServerDeletable ? 'deleteForEveryone' : 'delete'
    );

    return (
      <ContextMenu
        id={triggerId}
        onShow={onContextMenuShown}
        onHide={onContextMenuHidden}
      >
        {!multipleAttachments && attachments && attachments[0] ? (
          <MenuItem
            attributes={{
              className: 'module-message__context__download',
            }}
            onClick={(e: Event) => {
              e.stopPropagation();
              if (onDownload) {
                onDownload(isDangerous);
              }
            }}
          >
            {window.i18n('downloadAttachment')}
          </MenuItem>
        ) : null}

        <MenuItem onClick={wrap(onCopyText)}>
          {window.i18n('copyMessage')}
        </MenuItem>
        <MenuItem
          attributes={{
            className: 'module-message__context__reply',
          }}
          onClick={this.onReplyPrivate}
        >
          {window.i18n('replyToMessage')}
        </MenuItem>
        <MenuItem
          attributes={{
            className: 'module-message__context__more-info',
          }}
          onClick={wrap(onShowDetail)}
        >
          {window.i18n('moreInformation')}
        </MenuItem>
        {showRetry ? (
          <MenuItem
            attributes={{
              className: 'module-message__context__retry-send',
            }}
            onClick={wrap(onRetrySend)}
          >
            {window.i18n('resend')}
          </MenuItem>
        ) : null}
        {isDeletable ? (
          <MenuItem
            attributes={{
              className: 'module-message__context__delete-message',
            }}
            onClick={wrap(onDelete)}
          >
            {deleteMessageCtxText}
          </MenuItem>
        ) : null}
        {isModerator && isPublic ? (
          <MenuItem onClick={wrap(onBanUser)}>
            {window.i18n('banUser')}
          </MenuItem>
        ) : null}
      </ContextMenu>
    );
  }

  public getWidth(): number | undefined {
    const { attachments, previews } = this.props;

    if (attachments && attachments.length) {
      const dimensions = getGridDimensions(attachments);
      if (dimensions) {
        return dimensions.width;
      }
    }

    if (previews && previews.length) {
      const first = previews[0];

      if (!first || !first.image) {
        return;
      }
      const { width } = first.image;

      if (
        isImageAttachment(first.image) &&
        width &&
        width >= MINIMUM_LINK_PREVIEW_IMAGE_WIDTH
      ) {
        const dimensions = getImageDimensions(first.image);
        if (dimensions) {
          return dimensions.width;
        }
      }
    }

    return;
  }

  public isShowingImage() {
    const { attachments, previews } = this.props;
    const { imageBroken } = this.state;

    if (imageBroken) {
      return false;
    }

    if (attachments && attachments.length) {
      const displayImage = canDisplayImage(attachments);

      return (
        displayImage &&
        ((isImage(attachments) && hasImage(attachments)) ||
          (isVideo(attachments) && hasVideoScreenshot(attachments)))
      );
    }

    if (previews && previews.length) {
      const first = previews[0];
      const { image } = first;

      if (!image) {
        return false;
      }

      return isImageAttachment(image);
    }

    return false;
  }

  // tslint:disable-next-line: cyclomatic-complexity
  public render() {
    const {
      authorPhoneNumber,
      direction,
      id,
      isKickedFromGroup,
      isRss,
      timestamp,
      selected,
      multiSelectMode,
      conversationType,
      isPublic,
      text,
    } = this.props;
    const { expired, expiring } = this.state;

    // The Date.now() is a workaround to be sure a single triggerID with this id exists
    const rightClickTriggerId = id
      ? String(`message-ctx-${id}-${Date.now()}`)
      : String(`message-ctx-${authorPhoneNumber}-${timestamp}`);
    if (expired) {
      return null;
    }

    const width = this.getWidth();
    const isShowingImage = this.isShowingImage();

    // We parse the message later, but we still need to do an early check
    // to see if the message mentions us, so we can display the entire
    // message differently
    const mentions = text ? text.match(window.pubkeyPattern) : [];
    const mentionMe =
      mentions &&
      mentions.some(m => m.slice(1) === window.lokiPublicChatAPI.ourKey);

    const isIncoming = direction === 'incoming';
    const shouldHightlight = mentionMe && isIncoming && isPublic;
    const divClasses = ['session-message-wrapper'];

    if (shouldHightlight) {
      //divClasses.push('message-highlighted');
    }
    if (selected) {
      divClasses.push('message-selected');
    }

    if (conversationType === 'group') {
      divClasses.push('public-chat-message-wrapper');
    }

    const enableContextMenu = !isRss && !multiSelectMode && !isKickedFromGroup;

    return (
      <div id={id} className={classNames(divClasses)}>
        <ContextMenuTrigger id={rightClickTriggerId}>
          {this.renderAvatar()}
          <div
            className={classNames(
              'module-message',
              `module-message--${direction}`,
              expiring ? 'module-message--expired' : null
            )}
            role="button"
            onClick={event => {
              const selection = window.getSelection();
              // Text is being selected
              if (selection && selection.type === 'Range') {
                return;
              }

              // User clicked on message body
              const target = event.target as HTMLDivElement;
              if (!multiSelectMode && target.className === 'text-selectable') {
                return;
              }

              if (id) {
                this.props.onSelectMessage(id);
              }
            }}
          >
            {this.renderError(isIncoming)}

            <div
              className={classNames(
                'module-message__container',
                `module-message__container--${direction}`
              )}
              style={{
                width: isShowingImage ? width : undefined,
              }}
              role="button"
              onClick={event => {
                const selection = window.getSelection();
                // Text is being selected
                if (selection && selection.type === 'Range') {
                  return;
                }

                // User clicked on message body
                const target = event.target as HTMLDivElement;
                if (target.className === 'text-selectable') {
                  return;
                }

                if (id) {
                  this.props.onSelectMessage(id);
                }
              }}
            >
              {this.renderAuthor()}
              {this.renderQuote()}
              {this.renderAttachment()}
              {this.renderPreview()}
              {this.renderEmbeddedContact()}
              {this.renderText()}
              {this.renderMetadata()}
            </div>
            {this.renderError(!isIncoming)}
            {enableContextMenu
              ? this.renderContextMenu(rightClickTriggerId)
              : null}
          </div>
        </ContextMenuTrigger>
      </div>
    );
  }

  private renderAuthor() {
    const {
      authorName,
      authorPhoneNumber,
      authorProfileName,
      conversationType,
      direction,
      isPublic,
    } = this.props;

    const title = authorName ? authorName : authorPhoneNumber;

    if (direction !== 'incoming' || conversationType !== 'group' || !title) {
      return null;
    }

    const shortenedPubkey = window.shortenPubkey(authorPhoneNumber);

    const displayedPubkey = authorProfileName
      ? shortenedPubkey
      : authorPhoneNumber;

    return (
      <div className="module-message__author">
        <ContactName
          phoneNumber={displayedPubkey}
          name={authorName}
          profileName={authorProfileName}
          module="module-message__author"
          i18n={window.i18n}
          boldProfileName={true}
          shouldShowPubkey={Boolean(isPublic)}
        />
      </div>
    );
  }

  private onReplyPrivate(e: Event) {
    e.stopPropagation();
    if (this.props && this.props.onReply) {
      this.props.onReply(this.props.timestamp);
    }
  }
}
