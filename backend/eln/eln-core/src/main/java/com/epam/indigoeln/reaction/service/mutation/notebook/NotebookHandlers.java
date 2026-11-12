package com.epam.indigoeln.reaction.service.mutation.notebook;

import com.epam.indigoeln.common.exception.InvalidRequestException;
import com.epam.indigoeln.eln.entity.ExperimentEntity;
import com.epam.indigoeln.eln.entity.NotebookAttachment;
import com.epam.indigoeln.eln.entity.NotebookEntity;
import com.epam.indigoeln.eln.model.ApplicationPermission;
import com.epam.indigoeln.eln.model.ExperimentStatus;
import com.epam.indigoeln.eln.repository.ExperimentRepository;
import com.epam.indigoeln.eln.repository.NotebookAttachmentRepository;
import com.epam.indigoeln.eln.repository.ProjectRepository;
import com.epam.indigoeln.eln.service.AttachmentService;
import com.epam.indigoeln.reaction.model.NotebookSnapshot;
import com.epam.indigoeln.reaction.model.mutation.ExperimentMutation;
import com.epam.indigoeln.reaction.model.mutation.NotebookMutation;
import com.epam.indigoeln.reaction.service.ExperimentModelService;
import com.epam.indigoeln.reaction.service.mutation.MutationHandlerFor;
import jakarta.enterprise.context.Dependent;
import jakarta.inject.Inject;

import java.text.MessageFormat;
import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static com.epam.indigoeln.common.exception.InvalidRequestException.validate;
import static com.epam.indigoeln.common.util.ModelUtil.editProperty;

@Dependent
@MutationHandlerFor(NotebookMutation.CreateNotebook.class)
class CreateNotebookHandler extends AbstractNotebookMutationHandler<NotebookMutation.CreateNotebook> {

    @Override
    protected void doValidateAccess(NotebookEntity notebook) {
        aclService.ensureAccess(notebook.getProject(), ApplicationPermission.CREATE_NOTEBOOKS);
    }

    @Override
    public String doHandle(NotebookEntity notebook, NotebookMutation.CreateNotebook mutation, NotebookMutationContext context, NotebookSnapshot snapshotBefore) {
        notebook.setName(mutation.name());
        notebook.setDescription(mutation.description());
        notebook.setRevision(0);
        notebook.setCreatedBy(userService.getCurrentUserEntity());
        aclService.initNotebookACL(notebook);
        return "Create notebook";
    }
}

@Dependent
@MutationHandlerFor(NotebookMutation.EditNotebookAttributes.class)
class EditNotebookAttributesHandler extends AbstractNotebookMutationHandler<NotebookMutation.EditNotebookAttributes> {

    private static final Set<ExperimentStatus> COMPATIBLE_EXPERIMENT_STATUSES =
            EnumSet.of(ExperimentStatus.OPEN, ExperimentStatus.REOPEN, ExperimentStatus.ARCHIVED);
    private static final String EXPERIMENT_STATUS_INCOMPATIBLE_MESSAGE = MessageFormat.format(
            "You can rename a notebook with experiments only in status {0}",
            COMPATIBLE_EXPERIMENT_STATUSES.stream()
                    .map(ExperimentStatus::name)
                    .collect(Collectors.joining("/")));

    @Inject
    ExperimentRepository experimentRepository;
    @Inject
    ExperimentModelService experimentModelService;

    @Override
    public String doHandle(NotebookEntity notebook, NotebookMutation.EditNotebookAttributes mutation, NotebookMutationContext context, NotebookSnapshot snapshotBefore) {
        List<String> summaryList = new ArrayList<>();
        boolean nameChanged = editProperty(
                mutation.name(),
                notebook::setName,
                summaryList,
                "name"
        );
        boolean updated = nameChanged;
        updated |= editProperty(
                mutation.description(),
                notebook::setDescription,
                summaryList,
                x -> "description"
        );

        if (nameChanged) {
            String newNotebookName = mutation.name().get();
            List<ExperimentEntity> experiments = experimentRepository.findByNotebookWithACLEntities(notebook);

            validateExperimentsStatus(experiments);

            for (ExperimentEntity experiment : experiments) {
                experimentModelService.applyMutation(experiment, new ExperimentMutation.ExperimentNameUpdated(newNotebookName));
            }
        }

        validate(updated, "Nothing to update");
        return entityMutationHelper.formatEditAttributesSummary(summaryList);
    }

    private void validateExperimentsStatus(Collection<ExperimentEntity> experiments) {
        final boolean allExperimentsWithCompatibleStatus = experiments.stream()
                .map(ExperimentEntity::getStatus)
                .allMatch(COMPATIBLE_EXPERIMENT_STATUSES::contains);
        if (!allExperimentsWithCompatibleStatus) {
            throw new InvalidRequestException(EXPERIMENT_STATUS_INCOMPATIBLE_MESSAGE);
        }
    }
}

@Dependent
@MutationHandlerFor(NotebookMutation.EditNotebookAccess.class)
class EditNotebookAccessHandler extends AbstractNotebookMutationHandler<NotebookMutation.EditNotebookAccess> {

    @Inject
    ProjectRepository projectRepository;

    @Override
    protected void doValidateAccess(NotebookEntity notebook) {
        aclService.ensureAccess(notebook, ApplicationPermission.MANAGE_NOTEBOOK_ACCESS);
    }

    @Override
    public String doHandle(NotebookEntity notebook, NotebookMutation.EditNotebookAccess mutation, NotebookMutationContext context, NotebookSnapshot snapshotBefore) {
        String summary = entityMutationHelper.formatEditAccessSummary(mutation.edits());
        projectRepository.lockProject(notebook.getProject());
        aclService.updateNotebookACL(notebook, mutation.edits());
        return summary;
    }
}

@Dependent
@MutationHandlerFor(NotebookMutation.CreateNotebookAttachment.class)
class CreateNotebookAttachmentHandler extends AbstractNotebookMutationHandler<NotebookMutation.CreateNotebookAttachment> {

    @Inject
    NotebookAttachmentRepository attachmentRepository;
    @Inject
    AttachmentService attachmentService;

    @Override
    public String doHandle(NotebookEntity notebook, NotebookMutation.CreateNotebookAttachment mutation, NotebookMutationContext context, NotebookSnapshot snapshotBefore) {
        NotebookAttachment attachment = attachmentRepository.getReference(mutation.attachmentID());
        attachmentService.doAddAttachment(notebook, attachment);
        return entityMutationHelper.formatCreateAttachmentSummary(attachment);
    }
}

@Dependent
@MutationHandlerFor(NotebookMutation.DeleteNotebookAttachment.class)
class DeleteNotebookAttachmentHandler extends AbstractNotebookMutationHandler<NotebookMutation.DeleteNotebookAttachment> {

    @Inject
    NotebookAttachmentRepository attachmentRepository;

    @Override
    public String doHandle(NotebookEntity notebook, NotebookMutation.DeleteNotebookAttachment mutation, NotebookMutationContext context, NotebookSnapshot snapshotBefore) {
        NotebookAttachment attachment = attachmentRepository.getReference(mutation.attachmentID());
        notebook.getAttachments().remove(attachment);
        attachment.setParent(null);
        attachment.setDeleted(true);
        return "Deleted attachment: " + attachment.getName();
    }
}

