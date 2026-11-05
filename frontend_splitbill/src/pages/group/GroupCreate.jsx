import React, { useContext, useEffect, useState } from "react";
import LabelAndInput from "../auth/LabelAndInput";
import { AuthContext } from "../../context/AuthProvider";
import Error from "../error/Error";
import api from "../../api/axios";
import axios from "axios";
import SelectMenu from "../expense/SelectMenu";
import getBackendError from "../../utils/getBackendError";

function GroupCreate({
  onClose,
  onInvitationSent,
  getGroups,
  prevGroup = null,
  setReceivedGroup = null,
}) {
  const { user } = useContext(AuthContext);
  const [group, setGroup] = useState({
    name: prevGroup ? prevGroup.name : "",
    description: prevGroup ? prevGroup.description : null,
    invitations: [""],
  });
  const [groupPicture, setGroupPicture] = useState(null);
  const [imgPreview, setImgPreview] = useState(
    prevGroup ? prevGroup.group_picture_path : "/default_group_picture.png",
  );

  const [friendOptions, setFriendOptions] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);

  // loading
  const [loading, setLoading] = useState(false);

  // error
  const [frontErrors, setFrontErrors] = useState([]);
  const [backErrors, setBackErrors] = useState({});

  useEffect(() => {
    if (!prevGroup) {
      setSelectedMembers([{ value: user.email, label: "You", isFixed: true }]);
    }
  }, []);

  // get friends for participants options
  const getFriends = async () => {
    try {
      const response = await api.get("/friends/name");

      const friendOptionsResponse = response.data.map((friend) => ({
        value: friend.email,
        label: friend.name,
      }));

      setFriendOptions(friendOptionsResponse);
    } catch (error) {
      setBackErrors(getBackendError(error));
    }
  };

  useEffect(() => {
    getFriends();
  }, []);

  useEffect(() => {
    setGroup((prevItem) => ({
      ...prevItem,
      invitations: selectedMembers.map((invite) => invite.value),
    }));
  }, [selectedMembers]);

  const handleChange = (e, title) => {
    setBackErrors({});
    setGroup((prevGroup) => ({
      ...prevGroup,
      [title]: e.target.value,
    }));
  };

  const handleFileChange = (e) => {
    setBackErrors({});
    const file = e.target.files[0];

    setGroupPicture(file);

    if (file) {
      setImgPreview(URL.createObjectURL(file));
    }
  };

  const handleCreateOption = (inputValue) => {
    setBackErrors({});
    const newOption = {
      value: inputValue.toLowerCase(),
      label: inputValue,
    };

    setFriendOptions((prev) => [...prev, newOption]);
    setSelectedMembers((prev) => [...prev, newOption]);
  };

  const nameChanged = group.name.trim() !== (prevGroup?.name ?? "");
  const descriptionChanged =
    (group.description ?? "") !== (prevGroup?.description ?? "");
  const groupPictureChanged = imgPreview !== prevGroup?.group_picture_path;
  const hasChanges = nameChanged || descriptionChanged || groupPictureChanged;

  const hasAdditionalInvitations = prevGroup && selectedMembers.length > 0;

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFrontErrors([]);
    setBackErrors({});

    const updatedInvitations = [];
    const mobileRegex = /^\d{10}$/;
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    for (let invitation of group.invitations) {
      const invite = invitation.trim();

      if (!invite) continue;

      if (emailRegex.test(invite)) {
        updatedInvitations.push({ email: invite });
      } else if (mobileRegex.test(invite)) {
        updatedInvitations.push({ mobile_number: invite });
      } else {
        setFrontErrors(["Please enter valid group invitations"]);
        return;
      }
    }

    try {
      setLoading(true);

      if (prevGroup) {
        if (hasChanges) {
          const formData = new FormData();
          formData.append("name", group.name);

          if (group.description != null) {
            formData.append("description", group.description);
          }

          if (groupPicture instanceof File) {
            formData.append("groupPicture", groupPicture);
          }

          const res = await axios.patch(
            `http://localhost:8000/api/groups/${prevGroup.id}`,
            formData,
            {
              withCredentials: true,
            },
            {
              headers: {
                "Content-Type": "multipart/form-data",
              },
            },
          );

          onClose();
          setReceivedGroup(res.data.group);
          await getGroups();
        }

        if (hasAdditionalInvitations) {
          const res = await api.post(`/groups/${prevGroup.id}/invitations`, {
            invitations: updatedInvitations,
          });

          onClose();

          await onInvitationSent();
        }

        return;
      }

      const res = await api.post("/groups", {
        name: group.name,
        description: group.description,
        invitations: updatedInvitations,
      });

      if (groupPicture) {
        const formData = new FormData();
        formData.append("groupPicture", groupPicture);

        const pictureRes = await axios.post(
          `http://localhost:8000/api/groups/${res.data.group.id}/picture`,
          formData,
          { withCredentials: true },
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          },
        );
      }

      await onInvitationSent();
      await getGroups();

      onClose();
    } catch (error) {
      setLoading(false);
      setBackErrors(getBackendError(error));
    }
  };

  return (
    <div onClick={onClose} className="outer-modal">
      <div className="inner-modal" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button type="button" onClick={onClose} className="cancel-icon">
          ✕
        </button>

        <h1 className="heading glittery-shadow pt-0 pb-5">
          {prevGroup ? "Edit group" : "Create a group"}
        </h1>
        <div>
          <form action="" className="space-y-5">
            {/* frontend errors */}
            {frontErrors.length > 0 && (
              <Error errors={frontErrors} />
            )}

            {/* backend errors */}
            {Object.keys(backErrors).length !== 0 && (
              <Error errors={backErrors.error} type={backErrors.type} />
            )}

            <div className="flex items-center gap-4">
              {/* Group Picture */}
              <div className="flex w-1/3 flex-col">
                <p className="form-lbl mb-2">Group Picture</p>

                <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-gray-300 bg-gray-50 p-3">
                  <img
                    className="h-24 w-24 rounded-full border border-gray-300 object-cover"
                    src={imgPreview}
                    alt="Group picture"
                  />

                  <input
                    onChange={handleFileChange}
                    type="file"
                    accept="image/*"
                    className="w-full text-sm text-slate-900 file:mr-2 file:rounded-md file:border-0 file:px-3 file:py-2 file:text-slate-700 file:bg-sky-100 file:cursor-pointer hover:file:bg-sky-200/50 file:transition-all duration-200 ease-out"
                  />
                </div>
              </div>

              {/* Group Details */}
              <div className="flex w-2/3 flex-col justify-between gap-3">
                <LabelAndInput
                  field={"name"}
                  labelValue={"Group name"}
                  type={"text"}
                  person={group}
                  placeholder={"Enter a group name"}
                  handleEvent={(e) => handleChange(e, "name")}
                  showError={false}
                  required={true}
                />

                <LabelAndInput
                  field={"description"}
                  labelValue={"Group Description"}
                  type={"text"}
                  person={group}
                  placeholder={"Enter a group description"}
                  handleEvent={(e) => handleChange(e, "description")}
                  showError={false}
                />
              </div>
            </div>

            <div className={`space-y-2`}>
              <SelectMenu
                options={friendOptions}
                value={selectedMembers}
                onChange={setSelectedMembers}
                field={"members"}
                label={prevGroup ? "Add more members" : "Group members"}
                placeholder={
                  "Invite by Email or Mobile number or Name if friend"
                }
                isMultiSelect={true}
                closeMenuOnSelect={true}
                isCreatable={true}
                onCreateOption={handleCreateOption}
                additionalInfo={
                  "Invite by Email, Mobile Number or by Name if Friend"
                }
              />
            </div>

            <button
              disabled={
                loading ||
                !group.name.trim() ||
                (prevGroup
                  ? !hasChanges && !hasAdditionalInvitations
                  : selectedMembers.length <= 1)
              }
              className="btn"
              type="submit"
              onClick={handleFormSubmit}
            >
              {prevGroup
                ? loading
                  ? "Editing..."
                  : "Edit"
                : loading
                  ? "Creating..."
                  : "Create"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default GroupCreate;
