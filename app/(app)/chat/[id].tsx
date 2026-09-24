import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { borderRadius, colors, spacing } from "../../../constants/theme";
import { useAuth } from "../../../context/AuthContext";
import {
    getChatById,
    markChatAsRead,
    sendChatMessage,
    subscribeToChatMessages,
    uploadChatImage,
} from "../../../services/chatService";
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
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateDivider(timestamp: any): string {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return "Today";
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ChatRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const chatId = Array.isArray(id) ? id[0] : id;

  const { user, userData } = useAuth();
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

  const flatListRef = useRef<FlatList>(null);

  // Load chat record and mark as read
  useEffect(() => {
    if (!chatId || !user) return;

    let isMounted = true;

    async function loadChat() {
      try {
        const fetchedChat = await getChatById(chatId);
        if (isMounted) {
          setChat(fetchedChat);
          setLoading(false);
        }
        await markChatAsRead(chatId, user.uid);
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
      Alert.alert("Send Error", err.message || "Failed to send message.");
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
        Alert.alert(
          "Permission Required",
          "Please enable photos permission to send images.",
        );
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
    } catch (err) {
      Alert.alert("Error", "Unable to pick image.");
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
                      ? colors.primary
                      : "rgba(0, 55, 49, 0.6)"
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
              {otherParticipant.fullName || "User"}
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
                {isOtherBusiness ? "Business Client" : "Youth Freelancer"}
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
              {chat.gigPay
                ? `$${chat.gigPay} ${chat.gigPayType === "hourly" ? "/ hr" : "Fixed Budget"}`
                : "Gig Details"}
              {chat.gigCategory ? ` • ${chat.gigCategory}` : ""}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.gigBannerAction}
            onPress={() => {
              Alert.alert(
                "Related Gig",
                `${chat.gigTitle}\nBudget: $${chat.gigPay || "N/A"}\nCategory: ${chat.gigCategory || "General"}`,
                [{ text: "Close" }],
              );
            }}
          >
            <Text style={styles.gigBannerActionText}>Details</Text>
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
            <Text style={styles.loadingSubtext}>Loading conversation...</Text>
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
                <Text style={styles.emptyChatTitle}>No messages yet</Text>
                <Text style={styles.emptyChatSub}>
                  Send a friendly greeting or use one of the quick replies below
                  to get started!
                </Text>
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
              <Text style={styles.previewTitle}>Image ready to send</Text>
              <Text style={styles.previewSub}>Add a message or hit send</Text>
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
                onPress={() => handleSend(item.text)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="flash-outline"
                  size={12}
                  color={colors.primary}
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.quickReplyText} numberOfLines={1}>
                  {item.text}
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
            placeholder="Type a message..."
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
    backgroundColor: "rgba(44, 73, 104, 0.3)",
    borderColor: "#7BA6D6",
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
    fontWeight: "800",
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
    fontWeight: "700",
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
    backgroundColor: "#7BA6D6",
  },
  headerRoleText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  gigToggleBtn: {
    padding: spacing.xs,
  },
  gigBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(111, 216, 199, 0.08)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(111, 216, 199, 0.2)",
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
    fontWeight: "700",
    color: colors.text,
  },
  gigBannerSubtitle: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: "600",
    marginTop: 1,
  },
  gigBannerAction: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: "rgba(111, 216, 199, 0.3)",
  },
  gigBannerActionText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
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
    fontWeight: "700",
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
    fontWeight: "600",
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
    backgroundColor: "rgba(44, 73, 104, 0.3)",
  },
  bubbleAvatarText: {
    fontSize: 11,
    fontWeight: "700",
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
    fontWeight: "500",
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
    color: "rgba(0, 55, 49, 0.75)",
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
    fontWeight: "700",
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
    borderColor: "rgba(111, 216, 199, 0.25)",
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  quickReplyText: {
    fontSize: 12,
    fontWeight: "600",
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
  },
  fullscreenImage: {
    width: "100%",
    height: "80%",
  },
});
