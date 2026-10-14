import { formatCurrency, formatDate, formatTime } from '../../../localization/format';
import { translate } from "../../../localization/i18n";
import { Text, TextInput } from '../../../components/LocalizedText';
import { useTranslation } from 'react-i18next';
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Modal, Platform, SafeAreaView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { borderRadius, colors, spacing, fonts } from "../../../constants/theme";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from '../../../context/ToastContext';
import {
    getChatById,
    markChatAsRead,
    sendChatMessage,
    subscribeToChatMessages,
    uploadChatImage,
} from "../../../services/chatService";
import { addGigToCalendar } from "../../../services/calendarService";
import { RatingModal } from "../../../components/reviews";
import {
    BUSINESS_QUICK_REPLIES,
    Chat,
    ChatMessage,
    FREELANCER_QUICK_REPLIES,
    ParticipantDetail,
} from "../../../types/chat";

function formatMessageTime(timestamp: any): string {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return formatTime(date);
}

function formatDateDivider(timestamp: any): string {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return translate("Today");
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return translate("Yesterday");
  return formatDate(date, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ChatRoomScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id?: string; conversationId?: string }>();
  const rawId = params.conversationId || params.id;
  const chatId = Array.isArray(rawId) ? rawId[0] : (rawId || '');

  const { user, userData } = useAuth();
  const toast = useToast();
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedImagePreview, setSelectedImagePreview] = useState<
    string | null
  >(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [showGigBanner, setShowGigBanner] = useState(true);
  const [calendarAdding, setCalendarAdding] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  // Load chat record and mark as read
  useEffect(() => {
    if (!chatId || !user) return;

    let isMounted = true;

    const userId = user.uid;
    async function loadChat() {
      try {
        const fetchedChat = await getChatById(chatId);
        if (isMounted) {
          setChat(fetchedChat);
          setLoading(false);
        }
        await markChatAsRead(chatId, userId);
      } catch (err) {
        console.error("Error fetching chat:", err);
        if (isMounted) setLoading(false);
      }
    }

    loadChat();

    // Subscribe to messages stream
    const unsubscribe = subscribeToChatMessages(
      chatId,
      (newMessages) => {
        if (isMounted) {
          setMessages(newMessages);
          setLoading(false);
        }
        markChatAsRead(chatId, user.uid);
      },
      (err) => {
        console.error("Error subscribing to messages:", err);
        if (isMounted) setLoading(false);
      },
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [chatId, user]);

  const otherParticipant: ParticipantDetail = useMemo(() => {
    if (!chat || !user) {
      return { uid: "", fullName: "User", role: "freelancer" };
    }
    const otherUid = chat.participants.find((p) => p !== user.uid) || "";
    return (
      chat.participantDetails?.[otherUid] || {
        uid: otherUid,
        fullName: "User",
        role: "freelancer",
      }
    );
  }, [chat, user]);

  const isOtherBusiness = otherParticipant.role === "client";
  const myRole = userData?.role || "freelancer";
  const quickReplies =
    myRole === "client" ? BUSINESS_QUICK_REPLIES : FREELANCER_QUICK_REPLIES;

  const currentParticipantDetail: ParticipantDetail = useMemo(() => {
    return {
      uid: user?.uid || "",
      fullName: userData?.fullName || user?.displayName || "User",
      photoURL: userData?.photoURL || "",
      role: (userData?.role as any) || "freelancer",
      email: user?.email || "",
    };
  }, [user, userData]);

  const handleSend = async (customText?: string) => {
    const textToSend = (
      customText !== undefined ? customText : inputText
    ).trim();
    if (
      (!textToSend && !selectedImagePreview) ||
      sending ||
      uploadingImage ||
      !user
    ) {
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    setSending(true);

    try {
      let uploadedMediaUrl: string | undefined = undefined;

      if (selectedImagePreview) {
        setUploadingImage(true);
        uploadedMediaUrl = await uploadChatImage(chatId, selectedImagePreview);
        setSelectedImagePreview(null);
        setUploadingImage(false);
      }

      await sendChatMessage(
        chatId,
        currentParticipantDetail,
        otherParticipant.uid,
        textToSend,
        uploadedMediaUrl,
        uploadedMediaUrl ? "image" : "text",
      );

      if (customText === undefined) {
        setInputText("");
      }

      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (err: any) {
      toast.error(t("Failed to send message."), err.message);
    } finally {
      setSending(false);
      setUploadingImage(false);
    }
  };

  const handlePickImage = async () => {
    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        toast.info(t("Permission Required"), t("Please enable photos permission to send images."));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setSelectedImagePreview(result.assets[0].uri);
        try {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch {}
      }
    } catch {
      toast.error(t("Unable to pick image."));
    }
  };

  const renderMessageItem = ({
    item,
    index,
  }: {
    item: ChatMessage;
    index: number;
  }) => {
    const isMe = item.senderId === user?.uid;
    const isImage = Boolean(item.mediaUrl);

    // Date divider calculation
    const prevMessage = index > 0 ? messages[index - 1] : null;
    const showDateDivider =
      !prevMessage ||
      formatDateDivider(item.createdAt) !==
        formatDateDivider(prevMessage.createdAt);

    if (item.type === 'system') {
      return (
        <View style={styles.messageRowWrapper}>
          {showDateDivider && (
            <View style={styles.dateDivider}>
              <Text style={styles.dateDividerText}>
                {formatDateDivider(item.createdAt)}
              </Text>
            </View>
          )}
          <View style={styles.systemMessageContainer}>
            <View style={styles.systemMessagePill}>
              <Ionicons name="sparkles" size={14} color="#047857" style={{ marginRight: 6 }} />
              <Text style={styles.systemMessageText}>{item.text}</Text>
            </View>
            <Text style={styles.systemMessageTime}>{formatMessageTime(item.createdAt)}</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.messageRowWrapper}>
        {showDateDivider && (
          <View style={styles.dateDivider}>
            <Text style={styles.dateDividerText}>
              {formatDateDivider(item.createdAt)}
            </Text>
          </View>
        )}

        <View
          style={[
            styles.messageBubbleRow,
            isMe ? styles.bubbleRowMe : styles.bubbleRowOther,
          ]}
        >
          {!isMe && (
            <View style={styles.bubbleAvatar}>
              {item.senderPhotoURL ? (
                <Image
                  source={{ uri: item.senderPhotoURL }}
                  style={styles.bubbleAvatarImg}
                />
              ) : (
                <View
                  style={[
                    styles.bubbleAvatarPlaceholder,
                    isOtherBusiness && styles.bubbleAvatarBusiness,
                  ]}
                >
                  <Text style={styles.bubbleAvatarText}>
                    {(item.senderName?.[0] || "U").toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          )}

          <View
            style={[
              styles.bubble,
              isMe ? styles.bubbleMe : styles.bubbleOther,
              isImage && styles.bubbleWithImage,
            ]}
          >
            {/* Image attachment */}
            {isImage && (
              <TouchableOpacity
                onPress={() => setFullscreenImage(item.mediaUrl!)}
                activeOpacity={0.9}
                style={styles.imageContainer}
              >
                <Image
                  source={{ uri: item.mediaUrl }}
                  style={styles.messageImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            )}

            {/* Text content */}
            {Boolean(item.text) && (
              <Text
                style={[
                  styles.bubbleText,
                  isMe ? styles.bubbleTextMe : styles.bubbleTextOther,
                ]}
              >
                {item.text}
              </Text>
            )}

            {/* Timestamp and Read Status */}
            <View
              style={[
                styles.metaRow,
                isMe ? styles.metaRowMe : styles.metaRowOther,
              ]}
            >
              <Text
                style={[
                  styles.timeText,
                  isMe ? styles.timeTextMe : styles.timeTextOther,
                ]}
              >
                {formatMessageTime(item.createdAt)}
              </Text>
              {isMe && (
                <Ionicons
                  name={
                    item.readBy?.length > 1 ? "checkmark-done" : "checkmark"
                  }
                  size={14}
                  color={
                    item.readBy?.length > 1
                      ? colors.primaryOnColor
                      : "rgba(255, 255, 255, 0.8)"
                  }
                  style={styles.checkIcon}
                />
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        {/* User Details */}
        <View style={styles.headerUserInfo}>
          <View style={styles.headerAvatarWrapper}>
            {otherParticipant.photoURL ? (
              <Image
                source={{ uri: otherParticipant.photoURL }}
                style={styles.headerAvatarImg}
              />
            ) : (
              <View
                style={[
                  styles.headerAvatarCircle,
                  isOtherBusiness && styles.headerAvatarBusiness,
                ]}
              >
                <Text style={styles.headerAvatarText}>
                  {(otherParticipant.fullName?.[0] || "U").toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.headerOnlineDot} />
          </View>

          <View style={styles.headerNameBlock}>
            <Text style={styles.headerName} numberOfLines={1}>
              {otherParticipant.fullName || t("User")}
            </Text>
            <View style={styles.headerRoleRow}>
              <View
                style={[
                  styles.roleDot,
                  isOtherBusiness
                    ? styles.roleDotBusiness
                    : styles.roleDotYouth,
                ]}
              />
              <Text style={styles.headerRoleText}>
                {isOtherBusiness ? t("Business Client") : t("Youth Freelancer")}
              </Text>
            </View>
          </View>
        </View>

        {/* Action button */}
        {chat?.gigId && (
          <TouchableOpacity
            style={styles.gigToggleBtn}
            onPress={() => setShowGigBanner((v) => !v)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={
                showGigBanner
                  ? "chevron-up-circle-outline"
                  : "briefcase-outline"
              }
              size={22}
              color={colors.primary}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Collapsible Gig Context Banner */}
      {chat?.gigTitle && showGigBanner && (
        <View style={styles.gigBanner}>
          <View style={styles.gigBannerIconWrap}>
            <Ionicons name="briefcase" size={16} color={colors.primary} />
          </View>
          <View style={styles.gigBannerInfo}>
            <Text style={styles.gigBannerTitle} numberOfLines={1}>
              {chat.gigTitle}
            </Text>
            <Text style={styles.gigBannerSubtitle}>
              {chat.gigPay ? t("{{value0}} {{value1}}", { value0: formatCurrency(chat.gigPay), value1: chat.gigPayType === "hourly" ? t("/ hr") : t("Fixed Budget") }) : t("Gig Details")}
              {chat.gigCategory ? t(" • {{value0}}", { value0: chat.gigCategory }) : ""}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.gigBannerAction}
            onPress={() => {
              Alert.alert(
                t("Related Gig"),
                t("{{value0}}\nBudget: {{value1}}\nCategory: {{value2}}", { value0: chat.gigTitle, value1: chat.gigPay ? formatCurrency(chat.gigPay) : t("N/A"), value2: chat.gigCategory || t("General") }),
                [{ text: t("Close") }],
              );
            }}
          >
            <Text style={styles.gigBannerActionText}>{t("Details")}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Main Messages Container */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingSubtext}>{t("Loading conversation...")}</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessageItem}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: false })
            }
            onLayout={() =>
              flatListRef.current?.scrollToEnd({ animated: false })
            }
            ListEmptyComponent={
              <View style={styles.emptyChatBox}>
                <Ionicons
                  name="chatbubbles-outline"
                  size={48}
                  color={colors.surfaceBorder}
                />
                <Text style={styles.emptyChatTitle}>{t("No messages yet")}</Text>
                <Text style={styles.emptyChatSub}>{t("Send a friendly greeting or use one of the quick replies below to get started!")}</Text>
              </View>
            }
          />
        )}

        {/* Selected Image Attachment Preview Bar */}
        {selectedImagePreview && (
          <View style={styles.imagePreviewBar}>
            <Image
              source={{ uri: selectedImagePreview }}
              style={styles.previewThumb}
            />
            <View style={styles.previewInfo}>
              <Text style={styles.previewTitle}>{t("Image ready to send")}</Text>
              <Text style={styles.previewSub}>{t("Add a message or hit send")}</Text>
            </View>
            <TouchableOpacity
              style={styles.removeImageBtn}
              onPress={() => setSelectedImagePreview(null)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={22} color={colors.error} />
            </TouchableOpacity>
          </View>
        )}

        {/* Quick Replies Chips Carousel */}
        <View style={styles.quickRepliesSection}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={quickReplies}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.quickRepliesList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.quickReplyChip}
                onPress={() => handleSend(t(item.text))}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="flash-outline"
                  size={12}
                  color={colors.primary}
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.quickReplyText} numberOfLines={1}>
                  {t(item.text)}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <TouchableOpacity
            style={styles.attachBtn}
            onPress={handlePickImage}
            disabled={uploadingImage || sending}
            activeOpacity={0.7}
          >
            <Ionicons name="image-outline" size={22} color={colors.primary} />
          </TouchableOpacity>

          <TextInput
            style={styles.textInput}
            placeholder={t("Type a message...")}
            placeholderTextColor={colors.placeholder}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
            editable={!sending && !uploadingImage}
          />

          <TouchableOpacity
            style={[
              styles.sendBtn,
              !inputText.trim() &&
                !selectedImagePreview &&
                styles.sendBtnDisabled,
            ]}
            onPress={() => handleSend()}
            disabled={
              (!inputText.trim() && !selectedImagePreview) ||
              sending ||
              uploadingImage
            }
            activeOpacity={0.85}
          >
            {sending || uploadingImage ? (
              <ActivityIndicator size="small" color={colors.primaryOnColor} />
            ) : (
              <Ionicons name="send" size={18} color={colors.primaryOnColor} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Fullscreen Image Modal */}
      <Modal
        visible={Boolean(fullscreenImage)}
        transparent
        animationType="fade"
      >
        <View style={styles.fullscreenOverlay}>
          <TouchableOpacity
            style={styles.closeModalBtn}
            onPress={() => setFullscreenImage(null)}
          >
            <Ionicons name="close" size={28} color="#FFF" />
          </TouchableOpacity>
          {fullscreenImage && (
            <Image
              source={{ uri: fullscreenImage }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* Rating Modal for Chat Counterpart */}
      {otherParticipant.uid ? (
        <RatingModal
          visible={showRatingModal}
          targetUserId={otherParticipant.uid}
          targetUserName={otherParticipant.fullName}
          targetUserPhotoURL={otherParticipant.photoURL}
          targetRole={otherParticipant.role === 'client' ? 'client' : 'freelancer'}
          gigId={chat?.gigId}
          gigTitle={chat?.gigTitle}
          onClose={() => setShowRatingModal(false)}
          onSuccess={() => {
            setShowRatingModal(false);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorderSubtle,
    backgroundColor: colors.surface,
  },
  backBtn: {
    padding: spacing.xs,
    marginRight: spacing.xs,
  },
  headerUserInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  headerAvatarWrapper: {
    position: "relative",
  },
  headerAvatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarBusiness: {
    backgroundColor: colors.accentLight,
    borderColor: colors.accent,
  },
  headerAvatarImg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  headerAvatarText: {
    fontSize: 16,
    fontFamily: fonts.bodyBold,
    color: colors.primary,
  },
  headerOnlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  headerNameBlock: {
    flex: 1,
  },
  headerName: {
    fontSize: 15,
    fontFamily: fonts.bodyBold,
    color: colors.text,
  },
  headerRoleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 1,
  },
  roleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  roleDotYouth: {
    backgroundColor: colors.primary,
  },
  roleDotBusiness: {
    backgroundColor: colors.accent,
  },
  headerRoleText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontFamily: fonts.bodyMedium,
  },
  gigToggleBtn: {
    padding: spacing.xs,
  },
  gigBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primaryLight,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    gap: spacing.sm,
  },
  gigBannerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  gigBannerInfo: {
    flex: 1,
  },
  gigBannerTitle: {
    fontSize: 13,
    fontFamily: fonts.bodyBold,
    color: colors.text,
  },
  gigBannerSubtitle: {
    fontSize: 11,
    color: colors.primary,
    fontFamily: fonts.bodySemiBold,
    marginTop: 1,
  },
  gigBannerActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  gigBannerCalendarBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: 4,
  },
  gigBannerCalendarText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
  },
  gigBannerAction: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    minHeight: 36,
    justifyContent: 'center',
  },
  gigBannerActionText: {
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    color: colors.primary,
  },
  gigBannerRateBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: "#F59E0B",
    gap: 4,
  },
  gigBannerRateText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#D97706",
  },
  systemMessageContainer: {
    alignItems: "center",
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  systemMessagePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    maxWidth: "92%",
  },
  systemMessageText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#047857",
    textAlign: "center",
    flexShrink: 1,
  },
  systemMessageTime: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  loadingSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  messagesList: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  emptyChatBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxl * 1.5,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  emptyChatTitle: {
    fontSize: 16,
    fontFamily: fonts.bodyBold,
    color: colors.text,
  },
  emptyChatSub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
  },
  messageRowWrapper: {
    width: "100%",
    marginVertical: 2,
  },
  dateDivider: {
    alignSelf: "center",
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.surfaceBorderSubtle,
    marginVertical: spacing.sm,
  },
  dateDividerText: {
    fontSize: 11,
    fontFamily: fonts.bodySemiBold,
    color: colors.textMuted,
  },
  messageBubbleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.xs,
    maxWidth: "85%",
  },
  bubbleRowMe: {
    alignSelf: "flex-end",
  },
  bubbleRowOther: {
    alignSelf: "flex-start",
  },
  bubbleAvatar: {
    marginRight: 4,
    marginBottom: 2,
  },
  bubbleAvatarImg: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  bubbleAvatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  bubbleAvatarBusiness: {
    backgroundColor: colors.accentLight,
  },
  bubbleAvatarText: {
    fontSize: 11,
    fontFamily: fonts.bodyBold,
    color: colors.primary,
  },
  bubble: {
    borderRadius: borderRadius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: "100%",
  },
  bubbleWithImage: {
    padding: 6,
  },
  bubbleMe: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 2,
  },
  bubbleOther: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderBottomLeftRadius: 2,
  },
  imageContainer: {
    borderRadius: borderRadius.md,
    overflow: "hidden",
    marginBottom: 4,
  },
  messageImage: {
    width: 220,
    height: 160,
    borderRadius: borderRadius.md,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  bubbleTextMe: {
    color: colors.primaryOnColor,
    fontFamily: fonts.bodyMedium,
  },
  bubbleTextOther: {
    color: colors.text,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-end",
    marginTop: 4,
  },
  metaRowMe: {},
  metaRowOther: {},
  timeText: {
    fontSize: 10,
  },
  timeTextMe: {
    color: "rgba(255, 255, 255, 0.8)",
  },
  timeTextOther: {
    color: colors.textMuted,
  },
  checkIcon: {
    marginLeft: 2,
  },
  imagePreviewBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  previewThumb: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.sm,
  },
  previewInfo: {
    flex: 1,
  },
  previewTitle: {
    fontSize: 12,
    fontFamily: fonts.bodyBold,
    color: colors.text,
  },
  previewSub: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  removeImageBtn: {
    padding: spacing.xs,
  },
  quickRepliesSection: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorderSubtle,
    paddingVertical: 8,
  },
  quickRepliesList: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  quickReplyChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 36,
    justifyContent: 'center',
  },
  quickReplyText: {
    fontSize: 12,
    fontFamily: fonts.bodySemiBold,
    color: colors.textSecondary,
    maxWidth: 240,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorderSubtle,
    gap: spacing.sm,
  },
  attachBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.text,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeModalBtn: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    padding: spacing.sm,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenImage: {
    width: "100%",
    height: "80%",
  },
});
